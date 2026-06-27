import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Module mocks -----------------------------------------------------------
// CSS side-effect imports are meaningless under jsdom — stub them out.
vi.mock('@phlix/ui/style.css', () => ({}));
vi.mock('@phlix/ui/fonts.css', () => ({}));
// polyfills runs at import time; harmless under jsdom but stub to keep it inert.
vi.mock('@/polyfills', () => ({}));

const fakePinia = { __pinia: true };
const fakeRouter = { __router: true };
const mountSpy = vi.fn();
const fakeApp = {
  mount: mountSpy,
  config: { globalProperties: { $pinia: fakePinia, $router: fakeRouter } }
};
const createPhlixApp = vi.fn(() => fakeApp);
vi.mock('@phlix/ui', () => ({
  createPhlixApp: (...args: unknown[]) => createPhlixApp(...args),
  usePlayerStore: vi.fn(() => ({})),
  useSpatialNav: vi.fn(),
  usePreferencesStore: vi.fn(() => ({ tv: true }))
}));

const FAKE_HEADERS = { 'X-Phlix-Device-ID': 'dev', 'X-Phlix-Device-Type': 'samsung-tizen' };
const buildPhlixHeaders = vi.fn(() => FAKE_HEADERS);
vi.mock('@phlix/contracts', () => ({
  buildPhlixHeaders: (...args: unknown[]) => buildPhlixHeaders(...args)
}));

const installTizenBridge = vi.fn(() => () => {});
vi.mock('@/tizenBridge', () => ({
  installTizenBridge: (...args: unknown[]) => installTizenBridge(...args)
}));

vi.mock('@/SpatialNavHost.vue', () => ({ default: { name: 'SpatialNavHost' } }));

// Second-app (createApp) mock — chainable use().use().mount().
const secondMount = vi.fn();
const secondUse = vi.fn();
const secondApp = { use: secondUse, mount: secondMount };
secondUse.mockReturnValue(secondApp);
vi.mock('vue', () => ({
  createApp: vi.fn(() => secondApp)
}));

describe('boot (Tizen renderer entry)', () => {
  beforeEach(() => {
    vi.resetModules();
    createPhlixApp.mockClear().mockReturnValue(fakeApp);
    mountSpy.mockClear();
    buildPhlixHeaders.mockClear().mockReturnValue(FAKE_HEADERS);
    installTizenBridge.mockClear().mockReturnValue(() => {});
    secondMount.mockClear();
    secondUse.mockClear().mockReturnValue(secondApp);
    vi.unstubAllEnvs();
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds samsung-tizen headers, creates a TV app with HLS config, mounts + bridges', async () => {
    globalThis.localStorage.setItem('phlix.serverUrl', 'http://my-tv-server:8096');
    globalThis.localStorage.setItem('phlix.deviceId', 'tizen-fixed');

    const mod = await import('@/main');
    await mod.boot();

    expect(buildPhlixHeaders).toHaveBeenCalledWith({
      deviceId: 'tizen-fixed',
      deviceName: 'Phlix for Samsung TV',
      deviceType: 'samsung-tizen'
    });

    expect(createPhlixApp).toHaveBeenCalledWith(
      expect.objectContaining({
        app: 'server',
        apiBase: 'http://my-tv-server:8096',
        deviceHeaders: FAKE_HEADERS,
        defaultTv: true,
        defaultTheme: 'nocturne',
        branding: { wordmark: 'Phlix' }
      })
    );

    const cfg = createPhlixApp.mock.calls[0][0] as { playerHlsConfig?: Record<string, unknown> };
    expect(cfg.playerHlsConfig).toBeDefined();
    expect(cfg.playerHlsConfig).toMatchObject({
      maxBufferLength: 60,
      capLevelToPlayerSize: true,
      enableSoftwareAES: true
    });

    expect(mountSpy).toHaveBeenCalledWith('#phlix-app');
    expect(installTizenBridge).toHaveBeenCalledWith(fakeApp);
  });

  it('mounts the spatial-nav host as a second app sharing pinia + router', async () => {
    const { createApp } = await import('vue');
    const mod = await import('@/main');
    await mod.boot();

    expect(createApp).toHaveBeenCalled();
    // shares the SAME pinia + router instances from the main app
    expect(secondUse).toHaveBeenCalledWith(fakePinia);
    expect(secondUse).toHaveBeenCalledWith(fakeRouter);
    expect(secondMount).toHaveBeenCalledWith('#phlix-spatial-host');
  });

  it('falls back to localhost when no server URL and no env URL', async () => {
    vi.stubEnv('VITE_PHLIX_SERVER_URL', '');
    const mod = await import('@/main');
    await mod.boot();
    expect(createPhlixApp).toHaveBeenLastCalledWith(
      expect.objectContaining({ app: 'server', apiBase: 'http://localhost:8096' })
    );
  });

  it('uses the build-time env URL when no persisted server URL', async () => {
    vi.stubEnv('VITE_PHLIX_SERVER_URL', 'http://env-tv:8096');
    const mod = await import('@/main');
    await mod.boot();
    expect(createPhlixApp).toHaveBeenLastCalledWith(
      expect.objectContaining({ apiBase: 'http://env-tv:8096' })
    );
  });
});
