/**
 * S520 — QuickConnectPanel wiring test (TV/client half).
 *
 * This pins the SEAM, not the algorithm (the algorithm lives in
 * quickconnect.test.ts): that the always-mounted surface appears only when a
 * server base exists AND no session does, that pairing hands the redeemed token
 * pair to the app's EXISTING `useAuthStore().setTokens` (no second store), and
 * that landing a session retires the surface. `@phlix/ui` and the session
 * factory are faked so nothing touches the network or real timers.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, reactive, ref } from 'vue';
import QuickConnectPanel from '@/quickconnect/QuickConnectPanel.vue';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const apiBaseRef = ref('');
const auth = reactive({
  isLoggedIn: false,
  setTokens: vi.fn(),
});

// Captured per-session so each test can drive the orchestrator's callbacks.
// `handles` records EVERY session the panel has created, in order — the
// RT-055 pins need the old (superseded) handle to prove stale writes drop.
const captured: {
  deps?: Record<string, any>;
  runCalls: number;
  stopCalls: number;
  handles: Array<{ run: () => Promise<string>; stop: () => void; isFinished: () => boolean }>;
} = {
  runCalls: 0,
  stopCalls: 0,
  handles: [],
};

// `@phlix/ui` fakes are module singletons; every mount must be unmounted or a
// stale instance's `eligible` watcher keeps reacting and contaminates the count.
const mounts: { unmount: () => void }[] = [];
function mkPanel() {
  const wrapper = mount(QuickConnectPanel);
  mounts.push(wrapper);
  return wrapper;
}

vi.mock('@phlix/ui', async () => ({
  // Forward the real pure-string exports the i18n accessor imports: the mock
  // replaces the whole module graph, and these two must stay genuine.
  ...(await vi.importActual<Record<string, unknown>>('@phlix/ui')),
  useApiBase: () => apiBaseRef,
  useAuthStore: () => auth,
  ApiClient: vi.fn(function () {
    return { get: vi.fn(), post: vi.fn() };
  }),
}));

vi.mock('@/quickconnect/quickConnectSession', () => ({
  createPairingSession: vi.fn((deps: Record<string, unknown>) => {
    captured.deps = deps;
    const handle = {
      run: vi.fn(() => {
        captured.runCalls += 1;
        return Promise.resolve('pairing');
      }),
      stop: vi.fn(() => {
        captured.stopCalls += 1;
      }),
      isFinished: vi.fn(() => false),
    };
    captured.handles.push(handle);
    return handle;
  }),
}));

function reset() {
  // unmount any component still live from the previous case FIRST, so its
  // `eligible` watcher cannot react to the singleton mock refs below.
  while (mounts.length) mounts.pop()!.unmount();
  apiBaseRef.value = '';
  auth.isLoggedIn = false;
  auth.setTokens.mockClear();
  captured.deps = undefined;
  captured.runCalls = 0;
  captured.stopCalls = 0;
  captured.handles.length = 0;
  globalThis.localStorage.clear();
}

describe('QuickConnectPanel — placement + token-store seam', () => {
  beforeEach(() => {
    vi.resetModules();
    reset();
  });

  afterEach(() => {
    // ensure a clean slate even if a case threw before the next reset().
    while (mounts.length) mounts.pop()!.unmount();
  });

  it('renders nothing and starts NO pairing when there is no server base', async () => {
    const wrapper = mkPanel();
    await nextTick();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(captured.runCalls).toBe(0);
  });

  it('renders nothing and starts NO pairing when already logged in', async () => {
    apiBaseRef.value = 'http://tv:8096';
    auth.isLoggedIn = true;
    const wrapper = mkPanel();
    await nextTick();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(captured.runCalls).toBe(0);
  });

  it('starts pairing once a server exists but no session does (kills password-on-remote)', async () => {
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkPanel();
    await nextTick();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(captured.runCalls).toBe(1);
    expect(captured.deps).toBeDefined();
  });

  it('lands the token pair through the EXISTING useAuthStore().setTokens seam', async () => {
    apiBaseRef.value = 'http://tv:8096';
    mkPanel();
    await nextTick();
    const applyTokens = captured.deps!.applyTokens as (t: { accessToken: string; refreshToken: string }) => void;
    applyTokens({ accessToken: 'ACC', refreshToken: 'REF' });
    // The app's one and only auth store received the pair; nothing else did.
    expect(auth.setTokens).toHaveBeenCalledWith('ACC', 'REF');
    // The base we paired against is mirrored back idempotently.
    expect(globalThis.localStorage.getItem('phlix.serverUrl')).toBe('http://tv:8096');
  });

  // ── RT-056 (review tizen__secnet #1) — the pairing mirror rides the sanitizer ──
  it('RT-056: the mirrored base also lands in the address history through the same gate', async () => {
    // The Connect/first-run edge persists chosen bases into BOTH slots
    // (phlix.serverUrl + phlix.serverHistory). The pairing mirror wrote only
    // the url slot raw — a paired base never became a re-seed candidate, and
    // nothing passed it through the storage gate at all. Post-cure the mirror
    // reuses resolveConfig's own writers, so both slots agree.
    apiBaseRef.value = 'http://tv:8096';
    mkPanel();
    await nextTick();
    (captured.deps!.applyTokens as (t: unknown) => void)({ accessToken: 'ACC', refreshToken: 'REF' });
    expect(globalThis.localStorage.getItem('phlix.serverUrl')).toBe('http://tv:8096');
    const history = JSON.parse(globalThis.localStorage.getItem('phlix.serverHistory') ?? '[]') as string[];
    expect(history).toContain('http://tv:8096');
  });

  it('RT-056: a refused scheme is never mirrored to persisted storage — the session still lands', async () => {
    // Pre-cure this wrote the poison verbatim: a `javascript:` base persisted
    // into phlix.serverUrl re-seeds the next cold boot's first-run Connect
    // and any history-driven re-entry — the exact stored-forever class the
    // M-TIZEN-07 gate exists to stop. The credential pair itself is real
    // (server answered the pairing), so setTokens must NOT be collateral.
    apiBaseRef.value = 'javascript:alert(1)';
    const wrapper = mkPanel();
    await nextTick();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true); // base present → panel offered
    (captured.deps!.applyTokens as (t: unknown) => void)({ accessToken: 'ACC', refreshToken: 'REF' });
    expect(auth.setTokens).toHaveBeenCalledWith('ACC', 'REF');
    expect(globalThis.localStorage.getItem('phlix.serverUrl')).toBeNull();
    expect(globalThis.localStorage.getItem('phlix.serverHistory')).toBeNull();
  });

  it('surfaces the short code (no QR) once the orchestrator offers one', async () => {
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkPanel();
    await nextTick();
    const onCode = captured.deps!.onCode as (code: string, exp: number | null, owner: unknown) => void;
    // RT-055: the publisher stamps its own session handle; the surface accepts
    // a code only from the session it currently holds.
    onCode('ABCD-1234', 1_800_000_000, captured.handles[captured.handles.length - 1]);
    await nextTick();
    expect(wrapper.find('[data-testid="qc-code"]').text()).toBe('ABCD-1234');
  });

  // ── RT-055 (review tizen__exploiter #4) — stale sessions cannot write ─────
  it('RT-055: a superseded session publishing late does not stamp its code on the live panel', async () => {
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkPanel();
    await nextTick();
    const first = captured.handles[0]!;
    const firstDeps = captured.deps!;
    // A dismissal retires the session, and choosing a different base re-offers
    // pairing (C16 contract) — the re-offer SUPERSEDES the dead session whose
    // initiate answer may still land late.
    await wrapper.find('[data-testid="qc-dismiss"]').trigger('click');
    await nextTick();
    apiBaseRef.value = 'http://tv2:8096';
    await nextTick();
    await nextTick();
    expect(captured.handles).toHaveLength(2);

    // The DEAD session reaches the (shared) onCode closure carrying its OWN
    // handle: pre-cure there was no owner argument at all, so this late write
    // stamped the stale code onto the live surface. Post-cure the panel
    // compares identity and drops it — the empty placeholder stays.
    firstDeps.onCode('STALE-1111', null, first);
    await nextTick();
    expect(wrapper.find('[data-testid="qc-code"]').exists()).toBe(false);

    // The CURRENT session still lands its code normally.
    const onCode = captured.deps!.onCode as (code: string, exp: number | null, owner: unknown) => void;
    onCode('FRESH-2222', null, captured.handles[1]);
    await nextTick();
    expect(wrapper.find('[data-testid="qc-code"]').text()).toBe('FRESH-2222');
  });

  it('is invisible-gated: the isVisible predicate is false once logged in, and pairing is torn down', async () => {
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkPanel();
    await nextTick();
    expect((captured.deps!.isVisible as () => boolean)()).toBe(true);
    // Landing a session (isLoggedIn → true) must stop polling and retire the surface.
    auth.isLoggedIn = true;
    await nextTick();
    await nextTick();
    expect(captured.stopCalls).toBeGreaterThanOrEqual(1);
    expect((captured.deps!.isVisible as () => boolean)()).toBe(false);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// C16 (tizen__casualgamer CRITICAL row 17) — the takeover is a door, never a
// wall. Pins: a persistent dismiss affordance in EVERY phase (pre-fix this was
// the dead end: undismissable outside terminal phases), click-retires semantics
// (session stopped, panel gone, the password sign-in beneath no longer covered),
// the BACK-ladder bell contract (an Escape keydown ON the takeover root retires
// it), the per-base re-offer, and the literal tripwire joining the panel root's
// `data-quick-connect-panel` attribute to the selector tizenBridge.ts probes.
// ---------------------------------------------------------------------------
describe('QuickConnectPanel — C16 dismissal contract', () => {
  beforeEach(() => {
    vi.resetModules();
    reset();
  });

  afterEach(() => {
    while (mounts.length) mounts.pop()!.unmount();
  });

  it('shows a persistent "Enter password instead" control in the NON-terminal initiating phase', async () => {
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkPanel();
    await nextTick();
    const dismiss = wrapper.find('[data-testid="qc-dismiss"]');
    expect(dismiss.exists()).toBe(true);
    expect(dismiss.text()).toBe('Enter password instead');
    // Retry stays phase-gated (terminal-only); the DISMISS control never is —
    // that asymmetry is precisely what made the pre-fix panel a dead end.
    expect(wrapper.find('[data-testid="qc-retry"]').exists()).toBe(false);
  });

  it('the dismiss control is present through pairing AND terminal phases (alongside retry)', async () => {
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkPanel();
    await nextTick();
    (captured.deps!.onStatusChange as (p: string) => void)('pairing');
    await nextTick();
    expect(wrapper.find('[data-testid="qc-dismiss"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="qc-retry"]').exists()).toBe(false);
    (captured.deps!.onStatusChange as (p: string) => void)('expired');
    await nextTick();
    expect(wrapper.find('[data-testid="qc-retry"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="qc-dismiss"]').exists()).toBe(true);
  });

  it('clicking dismiss stops the ceremony, retires the panel, and closes its poll gate', async () => {
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkPanel();
    await nextTick();
    expect((captured.deps!.isVisible as () => boolean)()).toBe(true);
    await wrapper.find('[data-testid="qc-dismiss"]').trigger('click');
    await nextTick();
    await nextTick();
    // Takeover gone — the route beneath it (the ui login form) is no longer covered.
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    // The pairing session was STOPPED and its invisibility gate is closed.
    expect(captured.stopCalls).toBeGreaterThanOrEqual(1);
    expect((captured.deps!.isVisible as () => boolean)()).toBe(false);
  });

  it('BACK contract: a bubbling Escape keydown ON the takeover root retires the panel', async () => {
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkPanel();
    await nextTick();
    // EXACTLY what the bridge's quick-connect layer close() dispatches (C16 test
    // in tizenBridge.test.ts pins the sender; this pins the receiver).
    wrapper
      .find('[data-quick-connect-panel]')
      .element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await nextTick();
    await nextTick();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(captured.stopCalls).toBeGreaterThanOrEqual(1);
  });

  it('a DIFFERENT server base re-offers pairing after a dismissal', async () => {
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkPanel();
    await nextTick();
    await wrapper.find('[data-testid="qc-dismiss"]').trigger('click');
    await nextTick();
    await nextTick();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    apiBaseRef.value = 'http://other:8097';
    await nextTick();
    await nextTick();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="qc-dismiss"]').exists()).toBe(true);
    expect(captured.runCalls).toBe(2);
  });

  it('tripwire: the takeover root attribute matches the selector the BACK ladder probes', async () => {
    // Panel and bridge speak through this literal contract; drift silently
    // re-orphans the takeover from the ladder — the exact C16 failure class.
    const bridge = readFileSync(join(__dirname, '../../src/tizenBridge.ts'), 'utf8');
    const match = /export const QUICK_CONNECT_SELECTOR = '([^']+)';/.exec(bridge);
    expect(match, 'QUICK_CONNECT_SELECTOR export').not.toBeNull();
    expect(match![1]).toBe('[data-quick-connect-panel]');
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkPanel();
    await nextTick();
    expect(wrapper.find(match![1]).exists()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RT-050 (tizen__casualgamer #2) — failure-copy honesty. Pre-cure EVERY initiate
// failure rendered "Could not reach the server."; the answered-refusal arm now
// names the refusal (the copy points at the always-mounted password pill), the
// genuine no-answer arm keeps the unreachable wording, and `unsupported` is
// NOT retryable — re-asking an old server cannot change its answer.
// ---------------------------------------------------------------------------
describe('QuickConnectPanel — RT-050 error-copy arms', () => {
  beforeEach(() => {
    vi.resetModules();
    reset();
  });

  afterEach(() => {
    while (mounts.length) mounts.pop()!.unmount();
  });

  it('the refused phase shows the unsupported copy with the password pill and NO retry', async () => {
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkPanel();
    await nextTick();
    (captured.deps!.onStatusChange as (p: string) => void)('unsupported');
    await nextTick();
    expect(wrapper.find('.quick-connect__lead').text()).toBe(
      'This server can’t do code sign-in yet — it needs updating. Use your password instead.',
    );
    expect(wrapper.find('[data-testid="qc-retry"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="qc-dismiss"]').exists()).toBe(true);
  });

  it('the no-answer phase keeps the unreachable wording AND the retry affordance', async () => {
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkPanel();
    await nextTick();
    (captured.deps!.onStatusChange as (p: string) => void)('error');
    await nextTick();
    expect(wrapper.find('.quick-connect__lead').text()).toBe('Could not reach the server.');
    expect(wrapper.find('[data-testid="qc-retry"]').exists()).toBe(true);
  });
});
