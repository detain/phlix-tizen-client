/**
 * Tizen TV client entry point and boot glue.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import './polyfills';
import { createApp } from 'vue';
import type { Pinia } from 'pinia';
import type { MenuItem, MediaItem } from '@phlix/ui';
import type { RouteRecordRaw } from 'vue-router';
import { createPhlixApp, buildAdminRoutes, LibraryScanPage, ApiClient, LocalStorageTokenStore, usePlayerStore } from '@phlix/ui';
import { buildPhlixHeaders } from '@phlix/contracts';
import '@phlix/ui/style.css';
import '@phlix/ui/fonts.css';
import { resolveAppConfig } from './resolveConfig';
import { resolveDeviceId } from './deviceId';
import { installTizenBridge } from './tizenBridge';
import { resolveHubRelayConfig, openHubRelayConnection } from './api/hubRelay';
import { useSyncPlayStore } from './stores/useSyncPlayStore';
import { wirePendingPlayMediaDispatcher } from './syncplayDispatch';
import SpatialNavHost from './SpatialNavHost.vue';
import ChapterOverlay from './components/ChapterOverlay.vue';
import SleepTimerOverlay from './components/SleepTimerOverlay.vue';
import SkipIntroOverlay from './components/SkipIntroOverlay.vue';
import UpNextOverlay from './components/UpNextOverlay.vue';
import PiPController from './components/PiPController.vue';
import ChaptersPage from './pages/ChaptersPage.vue';
import AudioTracksPage from './pages/AudioTracksPage.vue';
import ParentalControlsPage from './pages/ParentalControlsPage.vue';
import RecommendationsScreen from './screens/RecommendationsScreen.vue';

/**
 * Top-bar nav, mirroring the server web-ui. Without a supplied `menu` the shell
 * renders NO nav at all — including the admin-gated "Admin" entry — so this is
 * what makes Browse/Settings and the admin section reachable on the TV. "Admin"
 * is `requiresAdmin`, so the shell shows it only for an authenticated admin
 * (`useAuthStore().isAdmin`); the admin API is gated server-side regardless.
 * Tizen is server-mode only (see resolveConfig), so there is no hub branch.
 */
export function buildMenu(): MenuItem[] {
  return [
    // `libraryLinks` expands Browse into one nav link per library (fetched from
    // /api/v1/libraries), matching the per-library Browse sections.
    { id: 'browse', label: 'Browse', to: '/app', libraryLinks: true },
    { id: 'for-you', label: 'For You', to: '/app/recommendations' },
    { id: 'settings', label: 'Settings', to: '/app/settings' },
    { id: 'parental-controls', label: 'Parental Controls', to: '/app/parental-controls' },
    { id: 'admin', label: 'Admin', to: '/app/admin/dashboard', requiresAdmin: true }
  ];
}

/**
 * Routes: the shared Vue admin section (`/app/admin/*`, reachable via the gated
 * "Admin" nav entry) plus the library-scan page, mirroring the server web-ui.
 * Routes carry the full `/app` prefix (the router's history base is '/').
 */
export function buildExtraRoutes(): RouteRecordRaw[] {
  return [
    ...buildAdminRoutes(),
    { path: '/app/library/scan', name: 'library-scan', component: LibraryScanPage },
    { path: '/app/chapters/:id', name: 'chapters', component: ChaptersPage },
    { path: '/app/audio-tracks/:id', name: 'audio-tracks', component: AudioTracksPage },
    { path: '/app/recommendations', name: 'recommendations', component: RecommendationsScreen },
    { path: '/app/parental-controls', name: 'parental-controls', component: ParentalControlsPage },
  ];
}

// RAM-conscious HLS tuning for Samsung TV webviews (bounded buffers; cap level
// to player size; software AES so DRM-free HLS still plays on weaker decoders).
// Passed through to @phlix/ui's player via playerHlsConfig (v0.53.0).
const TIZEN_HLS_CONFIG = {
  maxBufferLength: 60,
  maxMaxBufferLength: 180,
  maxBufferSize: 100 * 1000 * 1000,
  backBufferLength: 90,
  capLevelToPlayerSize: true,
  enableSoftwareAES: true
};

const SERVER_URL_KEY = 'phlix.serverUrl';
const HUB_URL_KEY = 'phlix.hubUrl';
const HUB_SERVER_ID_KEY = 'phlix.hubServerId';
const HUB_ACCESS_TOKEN_KEY = 'phlix.hubAccessToken';

/**
 * S298 — wire the hub-relay `pending_command` consumer at boot.
 *
 * "Alexa, play X" lands on the hub's SyncPlay relay (`ws://<hub>:8804`), which
 * matches an authenticated (hub user, server) socket — NOT a SyncPlay room.
 * The consumer socket therefore opens WHENEVER the app is open with a hub
 * context, independently of any watch-together session (the old store socket
 * only opened inside an explicit room join). The hub context — hub URL, the
 * hub's server UUID, and the hub access JWT — is resolved from the persisted /
 * build-time slots the app already uses for its server URL; without one
 * nothing opens (the honest "no open app" state, mirroring the roku client's
 * direct-mode behavior).
 *
 * The store is the consumer surface: `applyPendingPlayMedia` adopts each
 * delivered frame into `pendingPlayMedia` (+ the `currentMediaId` carry) and
 * `wirePendingPlayMediaDispatcher` is the load-a-new-title path that resolves
 * the bare media id through the app's real ApiClient and drives the shared
 * @phlix/ui player.
 */
function wireHubRelayConsumer(
  pinia: Pinia,
  apiBase: string,
  storage: Storage | null,
  deviceHeaders: Record<string, string>,
): void {
  const hubRelay = resolveHubRelayConfig({
    serverUrl: apiBase,
    hubUrl: storage ? storage.getItem(HUB_URL_KEY) : null,
    serverId: storage ? storage.getItem(HUB_SERVER_ID_KEY) : null,
    envHubUrl: import.meta.env.VITE_PHLIX_HUB_URL ?? null,
    envHubServerId: import.meta.env.VITE_PHLIX_HUB_SERVER_ID ?? null,
    accessTokenProvider: () => (storage ? storage.getItem(HUB_ACCESS_TOKEN_KEY) : null),
  });
  if (!hubRelay) return;

  const syncPlay = useSyncPlayStore(pinia);
  openHubRelayConnection({
    ...hubRelay,
    onPendingCommand: (command) => syncPlay.applyPendingPlayMedia(command),
  });

  const client = new ApiClient({
    baseUrl: apiBase,
    tokenStore: new LocalStorageTokenStore(),
    headers: deviceHeaders,
  });
  wirePendingPlayMediaDispatcher(syncPlay, {
    player: usePlayerStore(pinia),
    resolveMedia: async ({ mediaId }) => {
      try {
        const response = await client.get<{ item: MediaItem }>(`/api/v1/media/${encodeURIComponent(mediaId)}`);
        return response.item ?? null;
      } catch {
        return null; // unresolved — the command stays in the store slot
      }
    },
    // No onUnresolved surface today: the command stays in the store's
    // `pendingPlayMedia` slot (never silently dropped) and the NEXT frame
    // replaces it — the honest refusal path keeps working. A future hub-mode
    // session UI can read the slot or wire this callback.
  });
}

export async function boot(): Promise<void> {
  await Promise.resolve();
  const storage = globalThis.localStorage;

  const serverUrl = storage ? storage.getItem(SERVER_URL_KEY) : null;
  const envUrl = import.meta.env.VITE_PHLIX_SERVER_URL ?? null;
  const deviceId = resolveDeviceId(storage);

  const { app, apiBase } = resolveAppConfig({ serverUrl, envUrl });

  const deviceHeaders = buildPhlixHeaders({
    deviceId,
    deviceName: 'Phlix for Samsung TV',
    deviceType: 'samsung-tizen'
  });

  const application = createPhlixApp({
    app,
    apiBase,
    deviceHeaders,
    defaultTv: true,
    defaultTheme: 'nocturne',
    branding: { wordmark: 'Phlix' },
    // The TV ships with no server baked in. When `apiBase` is empty (nothing
    // persisted/seeded yet) @phlix/ui routes to its first-run Connect screen
    // instead of showing a login form aimed at nothing. Mirror the chosen URL
    // back into localStorage so resolveAppConfig re-seeds it on the next launch.
    requireConnection: true,
    onConnectionChange: (url) => {
      if (!storage) return;
      if (url) storage.setItem(SERVER_URL_KEY, url);
      else storage.removeItem(SERVER_URL_KEY);
    },
    // Top-bar nav (incl. the admin-gated "Admin" entry) + the admin section,
    // mirroring the server web-ui. Without these the shell shows no nav at all.
    menu: buildMenu(),
    extraRoutes: buildExtraRoutes(),
    playerHlsConfig: TIZEN_HLS_CONFIG
  });

  application.mount('#phlix-app');

  installTizenBridge(application);

  // The main app's pinia/router, shared with the overlay apps below.
  const pinia = application.config.globalProperties.$pinia;
  const router = application.config.globalProperties.$router;

  // S298 — the hub-relay pending_command consumer, open whenever the app is
  // open (never room-join-only). No-op when no hub context is configured.
  wireHubRelayConsumer(pinia, apiBase, storage, deviceHeaders);

  // Mount the spatial-nav host as a SECOND app sharing the main app's pinia +
  // router, so it observes the same preferences + route state. createPhlixApp
  // exposes the active pinia/router on globalProperties.
  createApp(SpatialNavHost).use(pinia).use(router).mount('#phlix-spatial-host');

  // Mount the chapter overlay as a THIRD app sharing the main app's pinia +
  // router, so it observes the same route state and can display chapter
  // tick marks and labels on the player seekbar.
  createApp(ChapterOverlay).use(pinia).use(router).mount('#phlix-chapter-overlay');

  // Mount the sleep timer overlay as a FOURTH app sharing the main app's pinia +
  // router, so it observes the same route state and can display sleep timer controls.
  createApp(SleepTimerOverlay).use(pinia).use(router).mount('#phlix-sleep-timer-overlay');

  // Mount the skip intro/outro overlay as a FIFTH app sharing the main app's pinia +
  // router, so it observes the same route state and can display skip markers.
  createApp(SkipIntroOverlay).use(pinia).use(router).mount('#phlix-skip-intro-overlay');

  // Mount the PiP controller overlay as a SIXTH app sharing the main app's pinia +
  // router, so it observes the same route state and can toggle picture-in-picture.
  createApp(PiPController).use(pinia).use(router).mount('#phlix-pip-overlay');

  // Mount the up next overlay as a SEVENTH app sharing the main app's pinia +
  // router, so it observes the same route state and can display up next card.
  createApp(UpNextOverlay).use(pinia).use(router).mount('#phlix-up-next-overlay');
}

void boot();
