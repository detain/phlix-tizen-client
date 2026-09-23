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

const apiBaseRef = ref('');
const auth = reactive({
  isLoggedIn: false,
  setTokens: vi.fn(),
});

// Captured per-session so each test can drive the orchestrator's callbacks.
const captured: { deps?: Record<string, any>; runCalls: number; stopCalls: number } = {
  runCalls: 0,
  stopCalls: 0,
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
    return {
      run: vi.fn(() => {
        captured.runCalls += 1;
        return Promise.resolve('pairing');
      }),
      stop: vi.fn(() => {
        captured.stopCalls += 1;
      }),
      isFinished: vi.fn(() => false),
    };
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

  it('surfaces the short code (no QR) once the orchestrator offers one', async () => {
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkPanel();
    await nextTick();
    const onCode = captured.deps!.onCode as (code: string, exp: number | null) => void;
    onCode('ABCD-1234', 1_800_000_000);
    await nextTick();
    expect(wrapper.find('[data-testid="qc-code"]').text()).toBe('ABCD-1234');
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
