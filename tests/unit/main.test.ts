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
// Stub the admin route builder + page main.ts pulls from @phlix/ui to assemble
// its menu + extraRoutes; the builder returns a marker route so tests can assert it.
const ADMIN_ROUTE = { path: '/app/admin/dashboard', name: 'admin-dashboard' };
vi.mock('@phlix/ui', () => ({
  createPhlixApp: (...args: unknown[]) => createPhlixApp(...args),
  buildAdminRoutes: () => [ADMIN_ROUTE],
  LibraryScanPage: { template: '<div />' },
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
        branding: { wordmark: 'Phlix' },
        requireConnection: true,
        onConnectionChange: expect.any(Function)
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

  it('uses an EMPTY base (→ Connect screen) when no server URL and no env URL', async () => {
    vi.stubEnv('VITE_PHLIX_SERVER_URL', '');
    const mod = await import('@/main');
    await mod.boot();
    expect(createPhlixApp).toHaveBeenLastCalledWith(
      expect.objectContaining({ app: 'server', apiBase: '', requireConnection: true })
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

  it('mirrors a Connect-screen choice back into localStorage (and clears it on null)', async () => {
    vi.stubEnv('VITE_PHLIX_SERVER_URL', '');
    const mod = await import('@/main');
    await mod.boot();
    const cfg = createPhlixApp.mock.calls.at(-1)?.[0] as {
      onConnectionChange: (url: string | null) => void;
    };
    cfg.onConnectionChange('http://chosen-tv:8096');
    expect(globalThis.localStorage.getItem('phlix.serverUrl')).toBe('http://chosen-tv:8096');
    cfg.onConnectionChange(null);
    expect(globalThis.localStorage.getItem('phlix.serverUrl')).toBeNull();
  });
});

describe('buildMenu', () => {
  it('supplies Browse (libraryLinks) + Settings + admin-gated Admin', async () => {
    const { buildMenu } = await import('@/main');
    const menu = buildMenu();
    expect(menu.map((m) => m.id)).toEqual(['browse', 'settings', 'admin']);
    expect(menu.find((m) => m.id === 'browse')?.libraryLinks).toBe(true);
    expect(menu.find((m) => m.id === 'admin')).toMatchObject({
      to: '/app/admin/dashboard',
      requiresAdmin: true
    });
  });
});

describe('buildExtraRoutes', () => {
  it('registers the admin section + the library-scan route', async () => {
    const { buildExtraRoutes } = await import('@/main');
    const names = buildExtraRoutes().map((r) => r.name);
    expect(names).toContain('admin-dashboard');
    expect(names).toContain('library-scan');
  });
});

describe('boot wires the nav menu + admin routes', () => {
  it('passes menu (incl. admin) + extraRoutes to createPhlixApp', async () => {
    globalThis.localStorage.setItem('phlix.serverUrl', 'http://tv:8096');
    const mod = await import('@/main');
    await mod.boot();
    const cfg = createPhlixApp.mock.calls.at(-1)?.[0] as {
      menu: Array<{ id: string }>;
      extraRoutes: Array<{ name?: string }>;
    };
    expect(cfg.menu.some((m) => m.id === 'admin')).toBe(true);
    expect(cfg.extraRoutes.some((r) => r.name === 'admin-dashboard')).toBe(true);
  });
});
