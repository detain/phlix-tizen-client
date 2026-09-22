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
import { createPhlixApp, buildAdminRoutes, LibraryScanPage, ApiClient, LocalStorageTokenStore, usePlayerStore, useToastStore } from '@phlix/ui';
import { buildPhlixHeaders } from '@phlix/contracts';
import '@phlix/ui/style.css';
import '@phlix/ui/fonts.css';
import { resolveAppConfig, pushAddressHistory } from './resolveConfig';
import { resolveLocale, messagesForLocale } from './i18n';
import { probeBootBase } from './bootProbe';
import { resolveDeviceId } from './deviceId';
import { installTizenBridge } from './tizenBridge';
import { installGamepadBridge } from './remote/gamepadBridge';
import { resolveHubRelayConfig, openHubRelayConnection } from './api/hubRelay';
import { useSyncPlayStore } from './stores/useSyncPlayStore';
import { wirePendingPlayMediaDispatcher } from './syncplayDispatch';
import { buildTelemetryDeps, getConsent, startTelemetry } from './telemetry';
import SpatialNavHost from './SpatialNavHost.vue';
import ChapterOverlay from './components/ChapterOverlay.vue';
import SkipIntroOverlay from './components/SkipIntroOverlay.vue';
import PiPController from './components/PiPController.vue';
import ActionToastOverlay from './components/ActionToastOverlay.vue';
import ChaptersPage from './pages/ChaptersPage.vue';
import AudioTracksPage from './pages/AudioTracksPage.vue';
import SubtitleTracksPage from './pages/SubtitleTracksPage.vue';
import ParentalControlsPage from './pages/ParentalControlsPage.vue';
import RecommendationsScreen from './screens/RecommendationsScreen.vue';
import QuickConnectPanel from './quickconnect/QuickConnectPanel.vue';
import TelemetryConsent from './components/TelemetryConsent.vue';
import ScreenSaverOverlay from './components/ScreenSaverOverlay.vue';

/**
 * S517 T-10 — the admin console is a DEFAULT-OFF build flag. A TV should not
 * ship (or reach) an admin console: any value other than '1' (including unset)
 * omits BOTH the `buildAdminRoutes()` spread from {@link buildExtraRoutes} AND
 * the `admin` entry from {@link buildMenu}, so the route table has no admin at
 * all — `/app/admin/*` is unreachable on TV.
 * Honest scope (survey-c ruling + measured at this commit, no overclaim): the
 * admin PAGES were always lazy separate chunks (never boot-parsed), and the one
 * always-parsed admin cost — the ~454 KB merged `@phlix/ui` `index.css` design
 * system — is NOT reducible client-side. The flag DOES drop the admin-layout
 * chunk from the .wgt (measured here); it does NOT drop the page chunks,
 * because `@phlix/ui`'s shell statically imports its admin registry for label
 * lookup, keeping those lazy-import closures alive in the graph for Rollup.
 * Full admin-bundle exclusion (and the CSS-split) are therefore @phlix/ui
 * cross-repo follow-ups, not claims of this gate. `routeManifest.gate` is
 * unaffected: admin tuples come from ui. Read INSIDE the builders (not at
 * module scope) so `vi.stubEnv` can re-decide per boot, mirroring how
 * `VITE_PHLIX_SERVER_URL` is read.
 */
function tvAdminEnabled(): boolean {
  return import.meta.env.VITE_PHLIX_TV_ADMIN === '1';
}

/**
 * Top-bar nav, mirroring the server web-ui. Without a supplied `menu` the shell
 * renders NO nav at all — including the admin-gated "Admin" entry — so this is
 * what makes Browse/Settings and the admin section reachable on the TV. "Admin"
 * is `requiresAdmin` — the shell would show it only for an authenticated admin
 * (`useAuthStore().isAdmin`; the admin API is gated server-side regardless) —
 * AND, since S517 T-10, omitted from the table entirely unless the default-off
 * admin build flag is on. Tizen is server-mode only (see resolveConfig), so
 * there is no hub branch.
 */
export function buildMenu(): MenuItem[] {
  const items: MenuItem[] = [
    // `libraryLinks` expands Browse into one nav link per library (fetched from
    // /api/v1/libraries), matching the per-library Browse sections.
    { id: 'browse', label: 'Browse', to: '/app', libraryLinks: true },
    { id: 'for-you', label: 'For You', to: '/app/recommendations' },
    { id: 'settings', label: 'Settings', to: '/app/settings' },
    { id: 'parental-controls', label: 'Parental Controls', to: '/app/parental-controls' }
  ];
  if (tvAdminEnabled()) {
    items.push({ id: 'admin', label: 'Admin', to: '/app/admin/dashboard', requiresAdmin: true });
  }
  return items;
}

/**
 * Routes: the shared Vue admin section (`/app/admin/*`, reachable via the gated
 * "Admin" nav entry) plus the library-scan page, mirroring the server web-ui.
 * Routes carry the full `/app` prefix (the router's history base is '/').
 * S517 T-10: the admin spread is omitted entirely unless the flag is on —
 * with it off, `/app/admin/*` has NO matching route on the TV.
 */
export function buildExtraRoutes(): RouteRecordRaw[] {
  return [
    ...(tvAdminEnabled() ? buildAdminRoutes() : []),
    { path: '/app/library/scan', name: 'library-scan', component: LibraryScanPage },
    { path: '/app/chapters/:id', name: 'chapters', component: ChaptersPage },
    { path: '/app/audio-tracks/:id', name: 'audio-tracks', component: AudioTracksPage },
    // S407: the subtitle picker's consumer page (mirror of audio-tracks).
    { path: '/app/subtitle-tracks/:id', name: 'subtitle-tracks', component: SubtitleTracksPage },
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
 * The minimal storage surface boot() actually depends on. Declaring it here
 * (rather than the DOM `Storage`) lets the in-memory fallback below satisfy the
 * exact same contract, so every consumer sees a trusted, always-present object
 * instead of a nullable one it must re-guard at each call (Law 2: parse at the
 * boundary, trust internally).
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * A Map-backed `StorageLike` used when `globalThis.localStorage` is unavailable
 * (a privacy-mode Tizen webview throws `SecurityError` on the mere property
 * getter) or unwritable (quota). Session-scoped: reads/writes work for the
 * lifetime of the boot, persistence across launches is honestly lost — which
 * beats the alternative, a white screen.
 */
export function inMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/**
 * T-09: resolve the boot storage exactly once, never throwing. A `SecurityError`
 * from the `localStorage` getter or a quota failure on the write probe degrades
 * to the in-memory fallback instead of rejecting `boot()` into a blank screen.
 */
export function probeStorage(): StorageLike {
  try {
    const real = globalThis.localStorage;
    if (!real) return inMemoryStorage();
    const probeKey = '__phlix_storage_probe__';
    real.setItem(probeKey, '1');
    real.removeItem(probeKey);
    return real;
  } catch {
    // Getter threw / quota exceeded → in-memory fallback keeps the app alive.
    return inMemoryStorage();
  }
}

/**
 * T-09 white-screen guard: the terminal `.catch` for `boot()`. Any throw past
 * the storage probe (config resolution, app creation, mount) surfaces here as a
 * minimal readable message in the mount point instead of an unhandled rejection
 * behind a blank `#phlix-app`.
 */
export function renderBootFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[phlix] Fatal boot failure:', error);
  try {
    const host = document.getElementById('phlix-app');
    const text = `Phlix failed to start: ${message}`;
    if (host) host.textContent = text;
    else document.body.textContent = text;
  } catch {
    // The DOM itself is unavailable — there is nothing left to render into.
  }
}


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
  storage: StorageLike,
  deviceHeaders: Record<string, string>,
): void {
  const hubRelay = resolveHubRelayConfig({
    serverUrl: apiBase,
    hubUrl: storage.getItem(HUB_URL_KEY),
    serverId: storage.getItem(HUB_SERVER_ID_KEY),
    envHubUrl: import.meta.env.VITE_PHLIX_HUB_URL ?? null,
    envHubServerId: import.meta.env.VITE_PHLIX_HUB_SERVER_ID ?? null,
    accessTokenProvider: () => storage.getItem(HUB_ACCESS_TOKEN_KEY),
  });
  if (!hubRelay) return;

  const syncPlay = useSyncPlayStore(pinia);
  const toast = useToastStore(pinia);
  // S510 — the hub-relay ladder can exhaust while the TV is backgrounded. The
  // module then sleeps (no hammering) and surfaces the transient 'waiting-visible'
  // status; we reflect that as a SINGLE auto-dismissing, non-modal notice and drop
  // it the moment the socket recovers to any live state. Never a modal.
  let hubPausedNoticeId: number | null = null;
  openHubRelayConnection({
    ...hubRelay,
    onPendingCommand: (command) => syncPlay.applyPendingPlayMedia(command),
    onStatusChange: (status) => {
      if (status === 'waiting-visible') {
        if (hubPausedNoticeId === null) {
          hubPausedNoticeId = toast.warning('Hub connection paused — resumes when you open the app again', {
            duration: 6000,
          });
        }
        return;
      }
      if (hubPausedNoticeId !== null) {
        toast.dismiss(hubPausedNoticeId);
        hubPausedNoticeId = null;
      }
    },
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

export async function boot(fetchImpl?: typeof fetch): Promise<void> {
  const storage = probeStorage();

  const serverUrl = storage.getItem(SERVER_URL_KEY);
  const envUrl = import.meta.env.VITE_PHLIX_SERVER_URL ?? null;
  const deviceId = resolveDeviceId(storage);

  const { app, apiBase } = resolveAppConfig({ serverUrl, envUrl });

  // S515 AD-3 — classify a SET-but-UNREACHABLE base before committing to it
  // (the connect-gate alone only catches the EMPTY one). Skipped for an empty
  // base, so first-run behavior is byte-identical; never rejects.
  const bootProbe = await probeBootBase(apiBase, fetchImpl);

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
    // back into storage so resolveAppConfig re-seeds it on the next launch —
    // guarded because a quota/SecurityError here must not reject out of a
    // callback @phlix/ui invokes mid-interaction (T-09).
    requireConnection: true,
    onConnectionChange: (url) => {
      try {
        if (url) {
          storage.setItem(SERVER_URL_KEY, url);
          // S529 / AD-24 — record the address in the bounded history that seeds
          // the first-run connect suggestions (privilege-honest: this is the
          // data source that replaces a blind subnet sweep — see resolveConfig).
          pushAddressHistory(storage, url);
        } else storage.removeItem(SERVER_URL_KEY);
      } catch {
        // Persistence failed; the in-memory session value still drives this run.
      }
    },
    // Top-bar nav (incl. the admin-gated "Admin" entry) + the admin section,
    // mirroring the server web-ui. Without these the shell shows no nav at all.
    menu: buildMenu(),
    extraRoutes: buildExtraRoutes(),
    playerHlsConfig: TIZEN_HLS_CONFIG,
    // i18n seam (config-time, @phlix/ui R6.5c): the client-resolved locale's
    // override map flows into ui's mergeMessages OVER its English defaults.
    // Today only 'en' is registered and its override is EMPTY, so this is
    // behavior-identical to omitting the field — the wiring is the deliverable.
    // Locale priority: explicit → VITE_PHLIX_LOCALE → navigator.language → 'en'
    // (no privileged tizen.systeminfo call — see src/i18n/index.ts doctrine).
    messages: messagesForLocale(resolveLocale())
  });

  // S515 AD-3 — probe said unreachable: land the user on @phlix/ui's existing
  // D-pad-operable Connect screen instead of a live but silently-failing app.
  // ONE-SHOT, pre-mount `beforeEach`: the first navigation is steered to
  // `connect`, then the guard deregisters itself so a "Connect anyway" commit
  // (or any later navigation) boots normally — the probe is advisory, never a
  // permanent jail. An empty-base boot never reaches this (the connect-gate
  // already routes there), and the persisted `phlix.serverUrl` is deliberately
  // LEFT INTACT for the retry. Why not pass `apiBase: ''` instead: `@phlix/ui`
  // persists its own chosen base (`phlix.connection.apiBase`) and
  // `effectiveBase()` prefers it, so an empty config base would NOT fire the
  // gate after any past Connect commit — the router intercept works in both
  // storage states.
  if (bootProbe === 'unreachable') {
    const interceptRouter = application.config.globalProperties.$router;
    const stopIntercept = interceptRouter.beforeEach((to: { name?: unknown }) => {
      stopIntercept();
      return to.name === 'connect' ? true : { name: 'connect' };
    });
  }

  application.mount('#phlix-app');

  installTizenBridge(application);

  // S522 AD-20 — the gamepad→synthetic-keyboard bridge (dev / manual-QA input).
  // It feeds the SAME `document` key seam RemoteManager + @phlix/ui's spatial-nav
  // already read, so it needs no other wiring and touches no key table. It
  // installs idempotently and is a silent no-op where there is no Gamepad API
  // (a real TV, and every existing test) — so boot stays byte-identical there.
  installGamepadBridge();

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

  // Mount the skip intro/outro overlay as a FOURTH app sharing the main app's
  // pinia + router, so it observes the same route state and can display skip
  // markers.
  createApp(SkipIntroOverlay).use(pinia).use(router).mount('#phlix-skip-intro-overlay');

  // Mount the PiP controller overlay as a FIFTH app sharing the main app's pinia
  // + router, so it observes the same route state and can toggle picture-in-picture.
  createApp(PiPController).use(pinia).use(router).mount('#phlix-pip-overlay');

  // S516 AD-13 — mount the transient action-toast overlay as a SIXTH app sharing
  // the main app's pinia (one caption store, one slot), so every remote key and
  // D-pad landing gets its ~1 s glanceable echo. Presentational only: it never
  // takes focus (no tabindex, aria-hidden) and dismisses on the next key press.
  createApp(ActionToastOverlay).use(pinia).mount('#phlix-action-toast-overlay');

  // S520 AD-25 — mount the quick-connect pairing surface as a SEVENTH root app
  // sharing the main app's pinia (one auth store), so it observes the SAME
  // logged-in/server state the shell does. It self-gates: it renders and polls
  // ONLY when a server base exists but no session does, retires itself the
  // instant `useAuthStore().setTokens` lands a pairing, and issues zero requests
  // while hidden. The redeemed tokens hand back through that EXISTING seam — no
  // second token store is introduced anywhere in the flow.
  createApp(QuickConnectPanel).use(pinia).mount('#phlix-quick-connect');

  // S521 AD-27 — mount the one-time telemetry consent card as an EIGHTH root app
  // sharing the main app's pinia. It self-gates on "never decided && a server is
  // set", so a decided install renders nothing. Telemetry is OFF by default: the
  // heartbeat sender is only armed here when consent was ALREADY granted on a
  // prior launch (start-when-opted-in); a fresh opt-in is armed by the card
  // itself. The bounded payload + swallow-all live entirely in ./telemetry.
  createApp(TelemetryConsent).use(pinia).mount('#phlix-telemetry-consent');
  if (apiBase && getConsent(storage)) {
    startTelemetry(buildTelemetryDeps({ storage, baseUrl: apiBase }));
  }

  // S523 AD-21 — mount the idle screensaver overlay as a NINTH root app sharing
  // the main app's pinia, so its 1 s tick reads the SAME usePlayerStore().playing
  // signal the shell does and the overlay can never engage during active
  // playback. Any key routed through the RemoteManager seam wakes it. Zero
  // privilege change: the keep-awake leg is WITHHELD (the as-shipped manifest
  // grants no privilege/display — TN-2/S503 forbids pre-adding; see
  // ./screensaver's privilege verdict), and the overlay half needs no grant.
  createApp(ScreenSaverOverlay).use(pinia).mount('#phlix-screensaver');
}

void boot().catch(renderBootFailure);
