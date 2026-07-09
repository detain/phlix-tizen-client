/**
 * Tizen TV client entry point and boot glue.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import './polyfills';
import { createApp } from 'vue';
import type { MenuItem } from '@phlix/ui';
import type { RouteRecordRaw } from 'vue-router';
import { createPhlixApp, buildAdminRoutes, LibraryScanPage } from '@phlix/ui';
import { buildPhlixHeaders } from '@phlix/contracts';
import '@phlix/ui/style.css';
import '@phlix/ui/fonts.css';
import { resolveAppConfig } from './resolveConfig';
import { resolveDeviceId } from './deviceId';
import { installTizenBridge } from './tizenBridge';
import SpatialNavHost from './SpatialNavHost.vue';
import ChaptersPage from './pages/ChaptersPage.vue';
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
    { path: '/app/recommendations', name: 'recommendations', component: RecommendationsScreen },
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

export async function boot(): Promise<void> {
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

  // Mount the spatial-nav host as a SECOND app sharing the main app's pinia +
  // router, so it observes the same preferences + route state. createPhlixApp
  // exposes the active pinia/router on globalProperties.
  const pinia = application.config.globalProperties.$pinia;
  const router = application.config.globalProperties.$router;
  createApp(SpatialNavHost).use(pinia).use(router).mount('#phlix-spatial-host');
}

void boot();
