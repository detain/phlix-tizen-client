/**
 * S521 AD-27 — TelemetryConsent card SEAM test (the algorithm is pinned in
 * telemetry.test.ts). Asserts the one-time card appears only for a never-decided
 * install that already has a server, retires permanently on any choice, and that
 * Enable/Not-now route to the exact consent + start/stop calls. `@/telemetry` and
 * `@phlix/ui` are faked so nothing touches storage semantics, timers, or network.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import TelemetryConsent from '@/components/TelemetryConsent.vue';
import { spatialTakeover } from '@/spatial/focusCandidates';

const apiBaseRef = ref('');

// vi.hoisted because the `vi.mock('@/telemetry')` factory below is evaluated at
// import time (before this file's top-level consts init) — it must reference an
// already-initialised object. The consent value lives on `mock.state` so a test
// can read back what Enable/Not-now persisted through the faked setConsent.
const mock = vi.hoisted(() => {
  const state = { consent: null as string | null };
  return {
    CONSENT_KEY: 'phlix.telemetry.consent',
    state,
    getConsent: vi.fn(() => state.consent === 'true'),
    setConsent: vi.fn((_s: unknown, granted: boolean) => {
      state.consent = granted ? 'true' : 'false';
    }),
    startTelemetry: vi.fn(),
    stopTelemetry: vi.fn(),
    buildTelemetryDeps: vi.fn(() => ({ fake: 'deps' })),
  };
});

vi.mock('@phlix/ui', async () => ({
  // Forward the real pure-string exports the i18n accessor imports: the mock
  // replaces the whole module graph, and these two must stay genuine.
  ...(await vi.importActual<Record<string, unknown>>('@phlix/ui')),
  useApiBase: () => apiBaseRef,
}));

vi.mock('@/telemetry', () => ({
  CONSENT_KEY: mock.CONSENT_KEY,
  getConsent: mock.getConsent,
  setConsent: mock.setConsent,
  startTelemetry: mock.startTelemetry,
  stopTelemetry: mock.stopTelemetry,
  buildTelemetryDeps: mock.buildTelemetryDeps,
}));

const mounts: { unmount: () => void }[] = [];
function mkCard() {
  const wrapper = mount(TelemetryConsent);
  mounts.push(wrapper);
  return wrapper;
}

function reset() {
  while (mounts.length) mounts.pop()!.unmount();
  apiBaseRef.value = '';
  mock.state.consent = null;
  spatialTakeover.value = null;
  globalThis.localStorage.clear();
  for (const fn of [mock.getConsent, mock.setConsent, mock.startTelemetry, mock.stopTelemetry, mock.buildTelemetryDeps]) {
    fn.mockClear();
  }
}

describe('TelemetryConsent card — one-time gate + routing', () => {
  beforeEach(() => {
    vi.resetModules();
    reset();
  });

  afterEach(() => {
    while (mounts.length) mounts.pop()!.unmount();
  });

  it('is hidden when no server base exists (nothing to report to yet)', async () => {
    const wrapper = mkCard();
    await nextTick();
    expect(wrapper.find('[data-testid="telemetry-enable"]').exists()).toBe(false);
  });

  it('is hidden once a decision already exists (never re-nags)', async () => {
    // A prior "Not now" stores an explicit false — the card must NOT show for an
    // install that has already decided, so it gates on the RAW key being present
    // (getConsent() cannot tell an explicit decline from unset).
    globalThis.localStorage.setItem(mock.CONSENT_KEY, 'false');
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkCard();
    await nextTick();
    expect(wrapper.find('[data-testid="telemetry-enable"]').exists()).toBe(false);
  });

  it('appears for a never-decided install that has a server', async () => {
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkCard();
    await nextTick();
    expect(wrapper.find('[data-testid="telemetry-enable"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="telemetry-decline"]').exists()).toBe(true);
  });

  it('Enable persists consent and arms the sender', async () => {
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkCard();
    await nextTick();
    await wrapper.find('[data-testid="telemetry-enable"]').trigger('click');
    expect(mock.setConsent).toHaveBeenCalledWith(expect.anything(), true);
    expect(mock.startTelemetry).toHaveBeenCalledWith({ fake: 'deps' });
    // and the card retires
    expect(wrapper.find('[data-testid="telemetry-enable"]').exists()).toBe(false);
  });

  it('Not now records an explicit decline and does NOT start telemetry', async () => {
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkCard();
    await nextTick();
    await wrapper.find('[data-testid="telemetry-decline"]').trigger('click');
    expect(mock.setConsent).toHaveBeenCalledWith(expect.anything(), false);
    expect(mock.stopTelemetry).toHaveBeenCalled();
    expect(mock.startTelemetry).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="telemetry-decline"]').exists()).toBe(false);
  });

  it('yields to a full-bleed spatial takeover and resurfaces when it retires (M6)', async () => {
    // Review tizen__gameux M6: the QuickConnect pairing panel (z 12000) used
    // to BURY this z-9000 card for the whole ceremony — the one-time privacy
    // choice degraded to never-asked while its buttons stayed D-pad-live
    // underneath. The card now waits for the takeover mirror to clear.
    apiBaseRef.value = 'http://tv:8096';
    const wrapper = mkCard();
    await nextTick();
    expect(wrapper.find('[data-testid="telemetry-enable"]').exists()).toBe(true);

    spatialTakeover.value = document.createElement('div');
    await nextTick();
    expect(wrapper.find('[data-testid="telemetry-enable"]').exists()).toBe(false);

    spatialTakeover.value = null; // panel retired via dismiss or completed login
    await nextTick();
    expect(wrapper.find('[data-testid="telemetry-enable"]').exists()).toBe(true);
  });

  it('ships an explicit focus ring for its buttons on both engines of the floor (M3)', () => {
    // Review tizen__gameux M3: zero focus rules meant the consent choice was
    // clicked against the UA default ring — invisible at couch distance. Pin
    // the cure in the component source: a plain `:focus` arm (Chromium-85
    // floor) and the modern `:focus-visible` arm on the pill class.
    const source = readFileSync(
      join(__dirname, '..', '..', 'src', 'components', 'TelemetryConsent.vue'),
      'utf8'
    );
    expect(source).toMatch(/\.telemetry-consent__btn:focus\s*,\s*\.telemetry-consent__btn:focus-visible\s*\{/);
  });
});
