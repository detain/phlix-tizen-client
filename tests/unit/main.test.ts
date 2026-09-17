import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Module mocks -----------------------------------------------------------
// CSS side-effect imports are meaningless under jsdom — stub them out.
vi.mock('@phlix/ui/style.css', () => ({}));
vi.mock('@phlix/ui/fonts.css', () => ({}));
// polyfills runs at import time; harmless under jsdom but stub to keep it inert.
vi.mock('@/polyfills', () => ({}));

const fakePinia = { __pinia: true };
// S515 — boot() installs a ONE-SHOT pre-mount `beforeEach` (→ Connect) only when
// the probe verdict is 'unreachable'; the fake exposes the hook + unregister spy.
const routerUnregister = vi.fn();
const routerBeforeEach = vi.fn(() => routerUnregister);
const fakeRouter = { __router: true, beforeEach: routerBeforeEach };
const mountSpy = vi.fn();
const fakeApp = {
  mount: mountSpy,
  config: { globalProperties: { $pinia: fakePinia, $router: fakeRouter } }
};
const createPhlixApp = vi.fn(() => fakeApp);
// S510 — the hub-relay transient status surface uses the shared @phlix/ui toast
// store; fake it so we can assert the single, non-modal notice lifecycle.
const toastWarning = vi.fn(() => 4242);
const toastDismiss = vi.fn();
const fakeToast = {
  warning: toastWarning,
  dismiss: toastDismiss,
  info: vi.fn(() => 4242),
  error: vi.fn(() => 4242),
  success: vi.fn(() => 4242),
  show: vi.fn(() => 4242),
  clear: vi.fn()
};
// Stub the admin route builder + page main.ts pulls from @phlix/ui to assemble
// its menu + extraRoutes; the builder returns a marker route so tests can assert it.
const ADMIN_ROUTE = { path: '/app/admin/dashboard', name: 'admin-dashboard' };
// S515 — src/bootProbe.ts reuses the exported @phlix/ui probeServer; mock it so
// boot() paths (reachable / unreachable / empty-skip) are pinned without network.
const probeServerMock = vi.fn(async (..._args: unknown[]) => true);
vi.mock('@phlix/ui', () => ({
  createPhlixApp: (...args: unknown[]) => createPhlixApp(...args),
  buildAdminRoutes: () => [ADMIN_ROUTE],
  probeServer: (...args: unknown[]) => probeServerMock(...args),
  LibraryScanPage: { template: '<div />' },
  usePlayerStore: vi.fn(() => ({})),
  useSpatialNav: vi.fn(),
  usePreferencesStore: vi.fn(() => ({ tv: true })),
  useToastStore: () => fakeToast,
  // S500 vitest 3→5: vi.fn() mock is `new`-constructed by src/main.ts, and v4/v5
  // requires a function/class impl (an arrow impl is not a constructor).
  ApiClient: vi.fn(function () {
    return { get: vi.fn() };
  }),
  LocalStorageTokenStore: vi.fn(function () {
    return {};
  })
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

// S298 — the hub-relay consumer boot wiring: resolve → open → dispatch.
const resolveHubRelayConfigMock = vi.fn();
const openHubRelayConnectionMock = vi.fn();
vi.mock('@/api/hubRelay', () => ({
  resolveHubRelayConfig: (...args: unknown[]) => resolveHubRelayConfigMock(...args),
  openHubRelayConnection: (...args: unknown[]) => openHubRelayConnectionMock(...args)
}));

const wirePendingPlayMediaDispatcherMock = vi.fn(() => () => {});
vi.mock('@/syncplayDispatch', () => ({
  wirePendingPlayMediaDispatcher: (...args: unknown[]) => wirePendingPlayMediaDispatcherMock(...args)
}));

const applyPendingPlayMediaMock = vi.fn();
const fakeSyncPlayStore = {
  applyPendingPlayMedia: applyPendingPlayMediaMock,
  consumePendingPlayMedia: vi.fn(),
  pendingPlayMedia: null
};
vi.mock('@/stores/useSyncPlayStore', () => ({
  useSyncPlayStore: () => fakeSyncPlayStore
}));

vi.mock('@/SpatialNavHost.vue', () => ({ default: { name: 'SpatialNavHost' } }));

// Second-app (createApp) mock — chainable use().use().mount().
const secondMount = vi.fn();
const secondUse = vi.fn();
const secondApp = { use: secondUse, mount: secondMount };
secondUse.mockReturnValue(secondApp);
vi.mock('vue', () => ({
  createApp: vi.fn(() => secondApp),
  defineComponent: vi.fn((...args: unknown[]) => ({ setup: () => {}, ...args[0] })),
  computed: vi.fn((fn: unknown) => fn),
  reactive: vi.fn((obj: unknown) => obj),
  ref: vi.fn((val: unknown) => ({ value: val })),
  isRef: vi.fn(() => false),
  nextTick: vi.fn((fn: unknown) => Promise.resolve(fn())),
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
    resolveHubRelayConfigMock.mockClear().mockReturnValue(null);
    openHubRelayConnectionMock.mockClear();
    toastWarning.mockClear().mockReturnValue(4242);
    toastDismiss.mockClear();
    wirePendingPlayMediaDispatcherMock.mockClear().mockReturnValue(() => {});
    applyPendingPlayMediaMock.mockClear();
    probeServerMock.mockReset().mockImplementation(async () => true);
    routerBeforeEach.mockClear().mockReturnValue(routerUnregister);
    routerUnregister.mockClear();
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

  it('S298: resolves the hub context from the persisted slots at boot', async () => {
    globalThis.localStorage.setItem('phlix.serverUrl', 'http://tv:8096');
    globalThis.localStorage.setItem('phlix.hubUrl', 'http://hub-tv:8800');
    globalThis.localStorage.setItem('phlix.hubServerId', 'srv-abc123');
    globalThis.localStorage.setItem('phlix.hubAccessToken', 'hub-jwt');

    const mod = await import('@/main');
    await mod.boot();

    expect(resolveHubRelayConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        serverUrl: 'http://tv:8096',
        hubUrl: 'http://hub-tv:8800',
        serverId: 'srv-abc123',
        envHubUrl: null,
        envHubServerId: null,
        accessTokenProvider: expect.any(Function)
      })
    );
    expect(resolveHubRelayConfigMock.mock.calls[0][0].accessTokenProvider()).toBe('hub-jwt');
  });

  it('S298: opens the hub-relay consumer + wires the dispatch point when a hub context resolves', async () => {
    const resolved = {
      serverId: 'srv-abc123',
      hubBaseUrl: 'http://hub-tv:8800',
      tokenProvider: () => 'relay-tok'
    };
    resolveHubRelayConfigMock.mockReturnValue(resolved);

    const mod = await import('@/main');
    await mod.boot();

    expect(openHubRelayConnectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        serverId: 'srv-abc123',
        hubBaseUrl: 'http://hub-tv:8800',
        tokenProvider: expect.any(Function)
      })
    );
    const openCfg = openHubRelayConnectionMock.mock.calls[0][0] as {
      onPendingCommand: (command: unknown) => void;
    };
    // A delivered frame is adopted into the SyncPlay store (the consumer pair).
    openCfg.onPendingCommand({ mediaId: 'media-9' });
    expect(applyPendingPlayMediaMock).toHaveBeenCalledWith({ mediaId: 'media-9' });

    expect(wirePendingPlayMediaDispatcherMock).toHaveBeenCalledWith(
      fakeSyncPlayStore,
      expect.objectContaining({
        player: expect.anything(),
        resolveMedia: expect.any(Function)
      })
    );
  });

  it('S510: surfaces ONE transient, non-modal notice on waiting-visible and clears it on recovery', async () => {
    const resolved = {
      serverId: 'srv-abc123',
      hubBaseUrl: 'http://hub-tv:8800',
      tokenProvider: () => 'relay-tok'
    };
    resolveHubRelayConfigMock.mockReturnValue(resolved);

    const mod = await import('@/main');
    await mod.boot();

    const openCfg = openHubRelayConnectionMock.mock.calls[0][0] as {
      onStatusChange: (status: string) => void;
    };
    // Ladder exhausted → waiting-visible: exactly one auto-dismissing warning.
    openCfg.onStatusChange('waiting-visible');
    expect(toastWarning).toHaveBeenCalledTimes(1);
    expect(toastWarning.mock.calls[0][1]).toEqual(expect.objectContaining({ duration: 6000 }));
    // A repeat waiting-visible must NOT stack a second notice (single surface).
    openCfg.onStatusChange('waiting-visible');
    expect(toastWarning).toHaveBeenCalledTimes(1);
    // Any live status clears the transient notice (it never persists as a modal).
    openCfg.onStatusChange('open');
    expect(toastDismiss).toHaveBeenCalledWith(4242);
    // A fresh exhaustion starts one new notice.
    openCfg.onStatusChange('waiting-visible');
    expect(toastWarning).toHaveBeenCalledTimes(2);
  });

  it('S298: opens NOTHING when no hub context resolves (honest no-app-open state)', async () => {
    resolveHubRelayConfigMock.mockReturnValue(null);

    const mod = await import('@/main');
    await mod.boot();

    expect(openHubRelayConnectionMock).not.toHaveBeenCalled();
    expect(wirePendingPlayMediaDispatcherMock).not.toHaveBeenCalled();
  });
});

describe('buildMenu', () => {
  it('supplies Browse (libraryLinks) + For You + Settings + admin-gated Admin', async () => {
    // S517 T-10: the admin ENTRY is flag-gated — this pin runs it ON so the
    // admin-present coverage stands EXACTLY as before (strengthened, never
    // weakened); a separate case below pins the default-off table.
    vi.stubEnv('VITE_PHLIX_TV_ADMIN', '1');
    const { buildMenu } = await import('@/main');
    const menu = buildMenu();
    expect(menu.map((m) => m.id)).toEqual(['browse', 'for-you', 'settings', 'parental-controls', 'admin']);
    expect(menu.find((m) => m.id === 'browse')?.libraryLinks).toBe(true);
    expect(menu.find((m) => m.id === 'for-you')).toMatchObject({
      to: '/app/recommendations',
      label: 'For You'
    });
    expect(menu.find((m) => m.id === 'admin')).toMatchObject({
      to: '/app/admin/dashboard',
      requiresAdmin: true
    });
    vi.unstubAllEnvs();
  });

  it('S517 T-10 default (flag OFF): the admin ENTRY is omitted entirely', async () => {
    vi.stubEnv('VITE_PHLIX_TV_ADMIN', '');
    const { buildMenu } = await import('@/main');
    const menu = buildMenu();
    expect(menu.map((m) => m.id)).toEqual(['browse', 'for-you', 'settings', 'parental-controls']);
    expect(menu.some((m) => m.requiresAdmin)).toBe(false);
    // Non-destructive: everything else is byte-identical.
    expect(menu.find((m) => m.id === 'browse')?.libraryLinks).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe('buildExtraRoutes', () => {
  it('registers the admin section + the library-scan route', async () => {
    // S517 T-10: admin routes are flag-gated; run ON to preserve this pin.
    vi.stubEnv('VITE_PHLIX_TV_ADMIN', '1');
    const { buildExtraRoutes } = await import('@/main');
    const names = buildExtraRoutes().map((r) => r.name);
    expect(names).toContain('admin-dashboard');
    expect(names).toContain('library-scan');
    vi.unstubAllEnvs();
  });

  it('S517 T-10 default (flag OFF): buildAdminRoutes() is omitted from the table', async () => {
    vi.stubEnv('VITE_PHLIX_TV_ADMIN', '');
    const { buildExtraRoutes } = await import('@/main');
    const routes = buildExtraRoutes();
    const names = routes.map((r) => r.name);
    expect(names).not.toContain('admin-dashboard');
    expect(routes.some((r) => String(r.path).startsWith('/app/admin'))).toBe(false);
    // Non-destructive: every non-admin route of the table survives.
    expect(names).toEqual(
      expect.arrayContaining([
        'library-scan',
        'chapters',
        'audio-tracks',
        'subtitle-tracks',
        'recommendations',
        'parental-controls'
      ])
    );
    vi.unstubAllEnvs();
  });

  it('S407: registers BOTH track-picker pages — audio AND the new subtitle consumer', async () => {
    const { buildExtraRoutes } = await import('@/main');
    const routes = buildExtraRoutes();
    const names = routes.map((r) => r.name);
    expect(names).toContain('audio-tracks');
    expect(names).toContain('subtitle-tracks');
    const subtitle = routes.find((r) => r.name === 'subtitle-tracks');
    expect(subtitle?.path).toBe('/app/subtitle-tracks/:id');
  });
});

describe('boot wires the nav menu + admin routes', () => {
  it('passes menu (incl. admin) + extraRoutes to createPhlixApp', async () => {
    // S517 T-10: run with the admin flag ON — the admin-present wiring pin
    // stands exactly as before.
    vi.stubEnv('VITE_PHLIX_TV_ADMIN', '1');
    globalThis.localStorage.setItem('phlix.serverUrl', 'http://tv:8096');
    const mod = await import('@/main');
    await mod.boot();
    const cfg = createPhlixApp.mock.calls.at(-1)?.[0] as {
      menu: Array<{ id: string }>;
      extraRoutes: Array<{ name?: string }>;
    };
    expect(cfg.menu.some((m) => m.id === 'admin')).toBe(true);
    expect(cfg.extraRoutes.some((r) => r.name === 'admin-dashboard')).toBe(true);
    vi.unstubAllEnvs();
  });

  it('S517 T-10 default (flag OFF): boots the FULL app with no admin surface at all', async () => {
    vi.stubEnv('VITE_PHLIX_TV_ADMIN', '');
    globalThis.localStorage.setItem('phlix.serverUrl', 'http://tv:8096');
    const mod = await import('@/main');
    await mod.boot();
    const cfg = createPhlixApp.mock.calls.at(-1)?.[0] as {
      menu: Array<{ id: string }>;
      extraRoutes: Array<{ name?: string }>;
    };
    expect(cfg.menu.some((m) => m.id === 'admin')).toBe(false);
    expect(cfg.extraRoutes.some((r) => String(r.name).startsWith('admin'))).toBe(false);
    // Non-destructive: the rest of the boot is today's boot.
    expect(mountSpy).toHaveBeenCalledWith('#phlix-app');
    expect(secondMount).toHaveBeenCalledWith('#phlix-action-toast-overlay');
    vi.unstubAllEnvs();
  });
});

// S501 T-09 — the boot white-screen guards. On a privacy-mode Tizen webview the
// very first `globalThis.localStorage` read can throw `SecurityError`, and any
// throw past it used to reject the top-level `void boot()` unhandled → a blank
// screen. These pins prove the storage probe degrades gracefully and that boot()
// SURFACES failures so the `.catch(renderBootFailure)` guard can act on them.
describe('boot fallbacks (S501 T-09)', () => {
  it('probeStorage() degrades to an in-memory shim when the localStorage getter throws', async () => {
    const mod = await import('@/main');
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: storage disabled');
      },
    });
    try {
      const storage = mod.probeStorage();
      // Never throws; behaves like Storage for the lifetime of the session.
      storage.setItem('phlix.serverUrl', 'http://in-mem:8096');
      expect(storage.getItem('phlix.serverUrl')).toBe('http://in-mem:8096');
      storage.removeItem('phlix.serverUrl');
      expect(storage.getItem('phlix.serverUrl')).toBeNull();
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
    }
  });

  it('boot() runs to completion on a throwing localStorage (falls back, mounts the app)', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: storage disabled');
      },
    });
    try {
      const mod = await import('@/main');
      // No rejection despite storage being unavailable.
      await expect(mod.boot()).resolves.toBeUndefined();
      expect(createPhlixApp).toHaveBeenCalled();
      expect(mountSpy).toHaveBeenCalledWith('#phlix-app');
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
    }
  });

  it('boot() surfaces (rejects) when app creation throws — the guard the .catch needs', async () => {
    globalThis.localStorage.setItem('phlix.serverUrl', 'http://tv:8096');
    const mod = await import('@/main');
    createPhlixApp.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    await expect(mod.boot()).rejects.toThrow('boom');
  });

  it('renderBootFailure() writes a readable message into the mount point (no blank screen)', async () => {
    const mod = await import('@/main');
    document.body.innerHTML = '<div id="phlix-app"></div>';
    mod.renderBootFailure(new Error('kaboom'));
    expect(document.getElementById('phlix-app')?.textContent).toContain('kaboom');
  });
});

// S515 AD-3 — the boot probe. A SET-but-UNREACHABLE base must reach the ui's
// D-pad-operable Connect screen NON-fatally (real apiBase + persisted URL kept
// for retry; "Connect anyway" stays one keystream away); the EMPTY base must
// behave byte-identically to before (connect-gate owns it — no probe fires).
describe('S515 boot probe (AD-3)', () => {
  beforeEach(() => {
    // Same isolation the boot suite uses: fresh module graph + empty storage,
    // so probe-intercept counts are per-test.
    vi.resetModules();
    createPhlixApp.mockClear().mockReturnValue(fakeApp);
    mountSpy.mockClear();
    secondMount.mockClear();
    secondUse.mockClear().mockReturnValue(secondApp);
    resolveHubRelayConfigMock.mockClear().mockReturnValue(null);
    openHubRelayConnectionMock.mockClear();
    probeServerMock.mockReset().mockImplementation(async () => true);
    routerBeforeEach.mockClear().mockReturnValue(routerUnregister);
    routerUnregister.mockClear();
    globalThis.localStorage.clear();
  });

  it('probes a set base at boot with the resolved base + a fetch impl', async () => {
    // Import first: main.ts fires an implicit `void boot()` at module load
    // (against the empty storage cleared above → probe-less 'empty' path). The
    // explicit boot() below is the one under test.
    const mod = await import('@/main');
    probeServerMock.mockClear();
    globalThis.localStorage.setItem('phlix.serverUrl', 'http://probe-me:8096');
    await mod.boot();
    expect(probeServerMock).toHaveBeenCalledTimes(1);
    expect(probeServerMock.mock.calls[0][0]).toBe('http://probe-me:8096');
    expect(typeof probeServerMock.mock.calls[0][1]).toBe('function');
  });

  it('reachable base → boots exactly as before, NO connect intercept installed', async () => {
    const mod = await import('@/main');
    routerBeforeEach.mockClear();
    globalThis.localStorage.setItem('phlix.serverUrl', 'http://alive:8096');
    await mod.boot();
    expect(routerBeforeEach).not.toHaveBeenCalled();
    expect(mountSpy).toHaveBeenCalledWith('#phlix-app');
  });

  it('set-but-unreachable → real apiBase kept + ONE-SHOT connect intercept installed before mount', async () => {
    probeServerMock.mockImplementationOnce(async () => false);
    const mod = await import('@/main');
    // The implementationOnce above is consumed by the import-time boot; give
    // the boot under test its own failing probe, then clear the noise.
    probeServerMock.mockClear();
    routerBeforeEach.mockClear();
    probeServerMock.mockImplementationOnce(async () => false);
    globalThis.localStorage.setItem('phlix.serverUrl', 'http://dead:8096');
    await mod.boot();

    // Non-destructive: config keeps the set base, storage keeps it for the retry.
    const cfg = createPhlixApp.mock.calls.at(-1)?.[0] as { apiBase: string };
    expect(cfg.apiBase).toBe('http://dead:8096');
    expect(globalThis.localStorage.getItem('phlix.serverUrl')).toBe('http://dead:8096');

    expect(routerBeforeEach).toHaveBeenCalledTimes(1);
    const guard = routerBeforeEach.mock.calls[0][0] as (to: { name?: string }) => unknown;
    // Any landing route is steered to Connect ONCE, then the guard deregisters.
    expect(guard({ name: 'app' })).toEqual({ name: 'connect' });
    expect(routerUnregister).toHaveBeenCalledTimes(1);
    // Still asked about the connect route itself? Let it render — no redirect loop.
    expect(guard({ name: 'connect' })).toBe(true);
    expect(mountSpy).toHaveBeenCalledWith('#phlix-app');
  });

  it('empty base skips the probe entirely (connect-gate path byte-identical)', async () => {
    vi.stubEnv('VITE_PHLIX_SERVER_URL', '');
    const mod = await import('@/main');
    await mod.boot();
    expect(probeServerMock).not.toHaveBeenCalled();
    expect(routerBeforeEach).not.toHaveBeenCalled();
    expect(createPhlixApp).toHaveBeenLastCalledWith(
      expect.objectContaining({ apiBase: '', requireConnection: true })
    );
  });

  it('T-09 NOT regressed: a throwing probe impl degrades to the offline route, boot resolves', async () => {
    const mod = await import('@/main');
    routerBeforeEach.mockClear();
    globalThis.localStorage.setItem('phlix.serverUrl', 'http://weird:8096');
    probeServerMock.mockImplementationOnce(async () => {
      throw new Error('probe must never sink boot');
    });
    await expect(mod.boot()).resolves.toBeUndefined();
    expect(routerBeforeEach).toHaveBeenCalledTimes(1);
    expect(mountSpy).toHaveBeenCalledWith('#phlix-app');
  });
});

// S516 AD-13 — the transient action-toast mounts as the SIXTH root app, and the
// terminal boot-failure surface (S515/T-09) stays a DIFFERENT single slot:
// renderBootFailure writes only #phlix-app/body and can never stack a toast
// under the error (the overlay only ever exists on a fully-successful boot).
describe('S516 action-toast overlay (AD-13)', () => {
  it('boots the action-toast overlay as a sixth root app', async () => {
    const mod = await import('@/main');
    await mod.boot();
    expect(secondMount).toHaveBeenCalledWith('#phlix-action-toast-overlay');
  });

  it('renderBootFailure never touches the toast host (no double-stacked boot errors)', async () => {
    document.body.innerHTML =
      '<div id="phlix-app"></div><div id="phlix-action-toast-overlay"></div>';
    const mod = await import('@/main');
    mod.renderBootFailure(new Error('dead boot'));
    expect(document.getElementById('phlix-app')?.textContent).toContain('dead boot');
    expect(document.getElementById('phlix-action-toast-overlay')?.textContent).toBe('');
  });
});

// S520 AD-25 — the quick-connect pairing surface mounts as the SEVENTH always-on
// root app (shares the main app's pinia → one auth store), so it observes the
// same server/session state and retires itself on landing a pairing. The panel
// self-gates (empty base / already-logged-in render nothing), so boot mounting
// it unconditionally is correct — the mount is the wiring, visibility is its own.
describe('S520 quick-connect overlay (AD-25)', () => {
  beforeEach(() => {
    vi.resetModules();
    createPhlixApp.mockClear().mockReturnValue(fakeApp);
    mountSpy.mockClear();
    secondMount.mockClear();
    secondUse.mockClear().mockReturnValue(secondApp);
    resolveHubRelayConfigMock.mockClear().mockReturnValue(null);
    openHubRelayConnectionMock.mockClear();
    probeServerMock.mockReset().mockImplementation(async () => true);
    globalThis.localStorage.clear();
  });

  it('boots the quick-connect panel as a seventh root app sharing pinia', async () => {
    const mod = await import('@/main');
    await mod.boot();
    expect(secondMount).toHaveBeenCalledWith('#phlix-quick-connect');
    // shares the SAME pinia instance as every other overlay app.
    expect(secondUse).toHaveBeenCalledWith(fakePinia);
  });
});
