import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PhlixMessagesConfig } from '@phlix/ui';

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
vi.mock('@phlix/ui', async () => ({
  // Forward the real pure-string exports the i18n accessor imports: the mock
  // replaces the whole module graph, and these two must stay genuine.
  ...(await vi.importActual<Record<string, unknown>>('@phlix/ui')),
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

// S522 AD-20 — boot installs the gamepad→key bridge once; mock it so the boot
// tests assert the call without starting a real rAF loop under jsdom.
const installGamepadBridge = vi.fn(() => () => {});
vi.mock('@/remote/gamepadBridge', () => ({
  installGamepadBridge: (...args: unknown[]) => installGamepadBridge(...args)
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

// S521 — boot starts the heartbeat ONLY when consent was already granted, so the
// telemetry module is faked with controllable consent + spies. buildTelemetryDeps
// echoes its input so the start call is observable without real timers/network.
const getConsentMock = vi.fn(() => false);
const startTelemetryMock = vi.fn();
vi.mock('@/telemetry', () => ({
  getConsent: (...a: unknown[]) => getConsentMock(...(a as [])),
  startTelemetry: (...a: unknown[]) => startTelemetryMock(...(a as [])),
  buildTelemetryDeps: vi.fn((x: unknown) => x),
}));

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
    vi.unstubAllGlobals();
  });

  it('M2 cure: the wired config.connectScan surfaces LAN-known servers as pick-from-list rows', async () => {
    globalThis.localStorage.setItem('phlix.serverUrl', 'http://192.168.1.40:8097');
    globalThis.localStorage.setItem('phlix.deviceId', 'tizen-fixed');
    globalThis.localStorage.setItem(
      'phlix.serverHistory',
      JSON.stringify(['http://192.168.1.40:8097', 'http://192.168.1.9:8097'])
    );
    // .40 answers phlix /health; .9 (CORS-shy) is network-opaque; the swept
    // gateway .1 answers {status:'ok'} without a version.
    const healthSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'http://192.168.1.40:8097/health') {
        return { ok: true, status: 200, json: async () => ({ status: 'ok', version: '1.2.3' }) } as Response;
      }
      if (url === 'http://192.168.1.1:8097/health') {
        return { ok: true, status: 200, json: async () => ({ status: 'ok' }) } as Response;
      }
      throw new TypeError('opaque network failure');
    });
    vi.stubGlobal('fetch', healthSpy);

    const mod = await import('@/main');
    await mod.boot();
    const cfg = createPhlixApp.mock.calls.at(-1)?.[0] as {
      connectScan?: () => Promise<Array<{ url: string; label?: string }>>;
    };
    expect(typeof cfg.connectScan).toBe('function');

    const rows = await cfg.connectScan!();
    // Confirmed rows lead (the known .40 with its version, then the swept
    // gateway .1); the unconfirmed-but-known .9 is still offered last; the
    // other silent sweep guesses never appear. Typing stays the fallback.
    expect(rows).toEqual([
      { url: 'http://192.168.1.40:8097', label: 'v1.2.3' },
      { url: 'http://192.168.1.1:8097' },
      { url: 'http://192.168.1.9:8097' },
    ]);
    // Privilege-honest transport: every probe is a plain root /health GET.
    for (const call of healthSpy.mock.calls) {
      expect(String(call[0])).toMatch(/\/health$/);
    }
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
        onConnectionChange: expect.any(Function),
        // Review tizen__casualgamer M2 — the connect-scan seam MUST be present:
        // omitting it silently hides the ui Scan affordance (the whole cure).
        connectScan: expect.any(Function)
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

  it('passes the i18n messages seam into createPhlixApp (en = empty override, behavior-preserving)', async () => {
    const mod = await import('@/main');
    createPhlixApp.mockClear();
    await mod.boot();

    const cfg = createPhlixApp.mock.calls[0][0] as { messages?: PhlixMessagesConfig };
    // The FIELD MUST be present — that is the wiring. With only the 'en' catalog
    // registered it is an EMPTY override map, so ui's mergeMessages reproduces
    // the English defaults exactly (proven deep in i18n.test.ts against the real
    // bundle). A missing key here would mean the seam silently un-wired itself.
    expect(cfg).toHaveProperty('messages');
    expect(cfg.messages).toEqual({});
  });

  it('S522 AD-20: boot installs the gamepad→key bridge exactly once', async () => {
    const mod = await import('@/main');
    // The import above fired the module-scope `void boot()` once; wipe that so
    // the count below reflects ONLY the explicit boot() under test.
    installGamepadBridge.mockClear();
    await mod.boot();
    expect(installGamepadBridge).toHaveBeenCalledTimes(1);
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
    // S529 / AD-24 — a Connect choice is also recorded into the bounded
    // address-history that seeds the first-run connect suggestions (privilege-
    // honest: this data source replaces a blind subnet sweep under `internet`).
    expect(JSON.parse(globalThis.localStorage.getItem('phlix.serverHistory') ?? '[]')).toEqual([
      'http://chosen-tv:8096',
    ]);
    cfg.onConnectionChange(null);
    expect(globalThis.localStorage.getItem('phlix.serverUrl')).toBeNull();
    // A null (disconnect) clears the active URL but keeps history for re-onboarding.
    expect(JSON.parse(globalThis.localStorage.getItem('phlix.serverHistory') ?? '[]')).toEqual([
      'http://chosen-tv:8096',
    ]);
  });

  it('M-TIZEN-07: onConnectionChange REFUSES a poisoned scheme at the storage boundary (clean value intact, history untouched, loud warn)', async () => {
    globalThis.localStorage.setItem('phlix.serverUrl', 'http://tv:8096');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mod = await import('@/main');
    await mod.boot();
    const cfg = createPhlixApp.mock.calls.at(-1)?.[0] as {
      onConnectionChange: (url: string | null) => void;
    };
    cfg.onConnectionChange('javascript:alert(document.cookie)');
    cfg.onConnectionChange(' JAVASCRIPT\t:alert(1)');
    cfg.onConnectionChange('data:text/html,<script>steal()</script>');
    // Refusing a bad write never destroys the good state, and the poison is
    // NEVER recorded into the suggestion history either.
    expect(globalThis.localStorage.getItem('phlix.serverUrl')).toBe('http://tv:8096');
    expect(globalThis.localStorage.getItem('phlix.serverHistory') ?? '[]').toBe('[]');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('non-http(s) scheme'));
    warnSpy.mockRestore();
  });

  it('M-TIZEN-07: a legacy-poisoned persisted base boots to the EMPTY base (→ Connect screen), never to the poison', async () => {
    vi.stubEnv('VITE_PHLIX_SERVER_URL', '');
    globalThis.localStorage.setItem('phlix.serverUrl', 'javascript:alert(1)');
    const mod = await import('@/main');
    await mod.boot();
    expect(createPhlixApp).toHaveBeenLastCalledWith(
      expect.objectContaining({ app: 'server', apiBase: '', requireConnection: true })
    );
  });

  it('M-TIZEN-07: a poisoned persisted hubUrl resolves as UNSET for the relay config (composes with the M-TIZEN-06 TLS law, which stays at the dial)', async () => {
    globalThis.localStorage.setItem('phlix.serverUrl', 'http://tv:8096');
    globalThis.localStorage.setItem('phlix.hubUrl', 'data:text/html,evil');
    globalThis.localStorage.setItem('phlix.hubServerId', 'srv-abc123');
    globalThis.localStorage.setItem('phlix.hubAccessToken', 'hub-jwt');
    const mod = await import('@/main');
    await mod.boot();
    expect(resolveHubRelayConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({ serverUrl: 'http://tv:8096', hubUrl: null, serverId: 'srv-abc123' })
    );
  });

  it('M-TIZEN-07: a poisoned persisted base is never a scan candidate, never the sweep anchor, never probed', async () => {
    globalThis.localStorage.setItem('phlix.serverUrl', 'javascript:alert(1)');
    globalThis.localStorage.setItem('phlix.deviceId', 'tizen-fixed');
    globalThis.localStorage.setItem(
      'phlix.serverHistory',
      JSON.stringify(['http://192.168.1.9:8097'])
    );
    const healthSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'http://192.168.1.1:8097/health') {
        return { ok: true, status: 200, json: async () => ({ status: 'ok', version: '9' }) } as Response;
      }
      throw new TypeError('opaque network failure');
    });
    vi.stubGlobal('fetch', healthSpy);

    const mod = await import('@/main');
    await mod.boot();
    const cfg = createPhlixApp.mock.calls.at(-1)?.[0] as {
      connectScan?: () => Promise<Array<{ url: string; label?: string }>>;
    };
    const rows = await cfg.connectScan!();
    // The persisted poison never reaches the rows…
    for (const row of rows) expect(row.url).not.toMatch(/javascript/i);
    // …and the sweep anchored on the most-recent CLEAN history address (the
    // gateway .1 confirmed it), so every probe URL is a plain http /health GET.
    for (const call of healthSpy.mock.calls) {
      expect(String(call[0])).toMatch(/^https?:\/\/[^/]+\/health$/);
    }
    expect(rows.map((row) => row.url)).toContain('http://192.168.1.1:8097');
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
    // L-4 follow-up: the scan route is admin-gated (see library-scan-route.test.ts).
    expect(buildExtraRoutes().find((r) => r.name === 'library-scan')?.meta).toEqual({
      requiresAdmin: true
    });
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

// S521 AD-27 — consent-gated telemetry. Boot mounts the one-time consent card as
// the EIGHTH root app (shares pinia), and arms the heartbeat sender ONLY when a
// prior launch already granted consent AND a server base exists. Default is OFF:
// unset consent never starts a sender, so "no consent → zero network" holds at
// the boot seam exactly as it does inside ./telemetry.
describe('S521 telemetry consent gate (AD-27)', () => {
  beforeEach(() => {
    vi.resetModules();
    createPhlixApp.mockClear().mockReturnValue(fakeApp);
    mountSpy.mockClear();
    secondMount.mockClear();
    secondUse.mockClear().mockReturnValue(secondApp);
    resolveHubRelayConfigMock.mockClear().mockReturnValue(null);
    openHubRelayConnectionMock.mockClear();
    probeServerMock.mockReset().mockImplementation(async () => true);
    getConsentMock.mockReset().mockReturnValue(false);
    startTelemetryMock.mockClear();
    globalThis.localStorage.clear();
  });

  it('mounts the telemetry consent card as an eighth root app sharing pinia', async () => {
    const mod = await import('@/main');
    await mod.boot();
    expect(secondMount).toHaveBeenCalledWith('#phlix-telemetry-consent');
  });

  it('default-OFF: does NOT start the heartbeat when consent is unset', async () => {
    globalThis.localStorage.setItem('phlix.serverUrl', 'http://tv:8096');
    getConsentMock.mockReturnValue(false);
    const mod = await import('@/main');
    await mod.boot();
    expect(startTelemetryMock).not.toHaveBeenCalled();
  });

  it('starts the heartbeat only when already opted-in AND a server base exists', async () => {
    // Import FIRST, against the storage cleared above, so the module-scope
    // `void boot()` runs on an EMPTY base (apiBase '' short-circuits before
    // getConsent) and never arms a sender. THEN set consent + a base and boot
    // once — the single start under test.
    const mod = await import('@/main');
    startTelemetryMock.mockClear();
    getConsentMock.mockReturnValue(true);
    globalThis.localStorage.setItem('phlix.serverUrl', 'http://tv:8096');
    await mod.boot();
    expect(startTelemetryMock).toHaveBeenCalledTimes(1);
    const arg = startTelemetryMock.mock.calls[0][0] as { baseUrl: string };
    expect(arg.baseUrl).toBe('http://tv:8096');
  });

  it('opted-in but no server base → does not start (nothing to report to)', async () => {
    getConsentMock.mockReturnValue(true);
    const mod = await import('@/main');
    await mod.boot();
    expect(startTelemetryMock).not.toHaveBeenCalled();
  });
});

// S523 AD-21 — the idle screensaver overlay mounts as the NINTH root app
// (shares pinia so its tick reads the same usePlayerStore().playing signal as
// the shell). Pin the mount seam only; the policy itself is pure in
// ./screensaver and lives-tested in ScreenSaverOverlay.test.ts.
describe('S523 idle screensaver overlay (AD-21)', () => {
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

  it('boots the screensaver overlay as a ninth root app sharing pinia', async () => {
    const mod = await import('@/main');
    await mod.boot();
    expect(secondMount).toHaveBeenCalledWith('#phlix-screensaver');
    expect(secondUse).toHaveBeenCalledWith(fakePinia);
  });
});

// Error-visibility brief (truth-pass r1: the original 'review tizen__devops M3'
// tag was fabricated provenance — see src/runtimeDiagnostics.ts header).
// The ring itself is
// unit-proven in tests/unit/runtimeDiagnostics.test.ts; THIS file owns the
// red→green registration chain: boot() wires the capture, an error event
// becomes a persisted buffer entry, the Vue bridge becomes one, and the
// boot-failure screen surfaces the tail. jsdom supplies the real `window`
// and the setup.ts localStorage mock, so the chain runs end-to-end.
describe('runtime failure visibility (error-visibility brief)', () => {
  beforeEach(() => {
    vi.resetModules();
    createPhlixApp.mockClear().mockReturnValue(fakeApp);
    mountSpy.mockClear();
    secondMount.mockClear();
    secondUse.mockClear().mockReturnValue(secondApp);
    resolveHubRelayConfigMock.mockClear().mockReturnValue(null);
    openHubRelayConnectionMock.mockClear();
    probeServerMock.mockReset().mockImplementation(async () => true);
    routerBeforeEach.mockClear().mockReturnValue(routerUnregister);
    globalThis.localStorage.clear();
  });

  function readRing(): Array<Record<string, unknown>> {
    return JSON.parse(globalThis.localStorage.getItem('phlix.runtimeFailures') ?? '[]') as Array<Record<string, unknown>>;
  }

  it('a healthy boot installs the capture WITHOUT writing the ring', async () => {
    globalThis.localStorage.setItem('phlix.serverUrl', 'http://my-tv:8096');
    globalThis.localStorage.setItem('phlix.deviceId', 'tizen-fixed');
    const mod = await import('@/main');
    await mod.boot();
    // Listeners are inert without failures — no diagnostics write on the happy path.
    expect(globalThis.localStorage.getItem('phlix.runtimeFailures')).toBeNull();
  });

  it('chain: window error event → ring entry → boot-failure screen quotes it', async () => {
    // The house renderBootFailure pattern (see the S515/S516 tests above):
    // REPLACE the body — a leftover #phlix-app from an earlier test would
    // otherwise win getElementById over an appended second element.
    document.body.innerHTML = '<div id="phlix-app"></div>';
    const host = document.getElementById('phlix-app')!;
    try {
      globalThis.localStorage.setItem('phlix.serverUrl', 'http://my-tv:8096');
      globalThis.localStorage.setItem('phlix.deviceId', 'tizen-fixed');
      const mod = await import('@/main');
      await mod.boot();

      const errorEvent = new Event('error');
      Object.defineProperty(errorEvent, 'message', { value: 'TypeError: shelf is undefined' });
      Object.defineProperty(errorEvent, 'filename', { value: 'app://-/assets/index.js' });
      Object.defineProperty(errorEvent, 'lineno', { value: 42 });
      window.dispatchEvent(errorEvent);

      // Every boot() in this file has installed a capture (module-scope boot +
      // the explicit one); they all record the SAME event and the 1 s
      // burst-suppression window collapses that to exactly one entry.
      const ring = readRing();
      expect(ring).toHaveLength(1);
      expect(ring[0]).toMatchObject({ kind: 'error', message: 'TypeError: shelf is undefined @ app://-/assets/index.js:42' });

      // The Vue bridge: production Vue console-errors component failures into
      // the void without app.config.errorHandler — boot must set it (the
      // vendored ui ships none; proven by grep at v0.99.10).
      const appCfg = fakeApp.config as { errorHandler?: (err: unknown, vm: unknown, info: string) => void };
      expect(typeof appCfg.errorHandler).toBe('function');
      appCfg.errorHandler!(new TypeError('watcher boom'), null, 'app watcher');
      const ringWithVue = readRing();
      expect(ringWithVue).toHaveLength(2);
      expect(ringWithVue[1]).toMatchObject({ kind: 'vue', message: 'TypeError: watcher boom (app watcher)' });

      // Surface: the terminal boot failure renders the plain line PLUS the
      // quoted prior failures (its own fatal entry excluded — it is quoted
      // on its own line already).
      mod.renderBootFailure(new Error('mount exploded'));
      expect(host.textContent).toContain('Phlix failed to start: mount exploded');
      expect(host.textContent).toContain('Recent failures:');
      expect(host.textContent).toMatch(/\[error\] \d\d:\d\d:\d\d TypeError: shelf is undefined @ app:\/\/-\/assets\/index\.js:42/);
      expect(host.textContent).toMatch(/\[vue\] \d\d:\d\d:\d\d TypeError: watcher boom \(app watcher\)/);
      expect(host.style.whiteSpace).toBe('pre-line');
      // The ring persists the fatal too — a TV that hard-dies leaves the
      // cause readable after relaunch.
      expect(readRing().at(-1)).toMatchObject({ kind: 'boot-fatal', message: 'mount exploded' });
    } finally {
      document.body.innerHTML = '';
    }
  });

  it('chain: unhandledrejection → ring entry', async () => {
    globalThis.localStorage.setItem('phlix.serverUrl', 'http://my-tv:8096');
    globalThis.localStorage.setItem('phlix.deviceId', 'tizen-fixed');
    const mod = await import('@/main');
    await mod.boot();

    const rejection = new Event('unhandledrejection');
    Object.defineProperty(rejection, 'reason', { value: new Error('pairing poll died') });
    window.dispatchEvent(rejection);

    const ring = readRing();
    expect(ring).toHaveLength(1);
    expect(ring[0]).toMatchObject({ kind: 'rejection', message: 'Error: pairing poll died' });
    expect(mod).toBeDefined();
  });

  it('a fatal with an empty ring renders the plain boot-failure line only (honest quiet)', async () => {
    document.body.innerHTML = '<div id="phlix-app"></div>';
    const host = document.getElementById('phlix-app')!;
    try {
      const mod = await import('@/main');
      await mod.boot(); // healthy → ring untouched
      mod.renderBootFailure(new Error('config exploded'));
      expect(host.textContent).toBe('Phlix failed to start: config exploded');
    } finally {
      document.body.innerHTML = '';
    }
  });
});
