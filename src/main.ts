import './polyfills';
import { createApp } from 'vue';
import { createPhlixApp } from '@phlix/ui';
import { buildPhlixHeaders } from '@phlix/contracts';
import '@phlix/ui/style.css';
import '@phlix/ui/fonts.css';
import { resolveAppConfig } from './resolveConfig';
import { resolveDeviceId } from './deviceId';
import { installTizenBridge } from './tizenBridge';
import SpatialNavHost from './SpatialNavHost.vue';

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
