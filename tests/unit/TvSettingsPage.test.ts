import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const startSpy = vi.hoisted(() => vi.fn());
const stopSpy = vi.hoisted(() => vi.fn());
vi.mock('@phlix/ui', async (orig) => ({
  ...(await orig<typeof import('@phlix/ui')>()),
  useApiBase: () => ({ value: 'http://srv.test' }),
}));
vi.mock('../../src/telemetry', async (orig) => ({
  ...(await orig<typeof import('../../src/telemetry')>()),
  startTelemetry: startSpy,
  stopTelemetry: stopSpy,
  buildTelemetryDeps: () => ({}),
}));
vi.mock('vue-router', () => ({ useRouter: () => ({ back: vi.fn() }) }));

import TvSettingsPage from '../../src/pages/TvSettingsPage.vue';
import { IDLE_TIMEOUT_KEY } from '../../src/screensaver';
import { CONSENT_KEY } from '../../src/telemetry';

describe('TvSettingsPage (TIZ-S16)', () => {
  beforeEach(() => {
    localStorage.clear();
    startSpy.mockClear();
    stopSpy.mockClear();
  });

  it('shows the 3 min default and steps with Enter/click and arrows, persisting', async () => {
    const w = mount(TvSettingsPage);
    const row = w.get('[data-testid="screensaver-idle-row"]');
    expect(w.get('[data-testid="screensaver-idle-value"]').text()).toBe('3 min');
    await row.trigger('click');
    expect(localStorage.getItem(IDLE_TIMEOUT_KEY)).toBe('300000');
    await row.trigger('keydown', { key: 'ArrowLeft' });
    await row.trigger('keydown', { key: 'ArrowLeft' });
    expect(localStorage.getItem(IDLE_TIMEOUT_KEY)).toBe('120000');
    expect(w.get('[data-testid="screensaver-idle-value"]').text()).toBe('2 min');
  });

  it('telemetry row reverses a prior decline and withdraws again (round trip)', async () => {
    localStorage.setItem(CONSENT_KEY, 'false');
    const w = mount(TvSettingsPage);
    const row = w.get('[data-testid="telemetry-row"]');
    expect(w.get('[data-testid="telemetry-value"]').text()).toBe('Off');
    await row.trigger('click');
    expect(localStorage.getItem(CONSENT_KEY)).toBe('true');
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(w.get('[data-testid="telemetry-value"]').text()).toBe('On');
    await row.trigger('click');
    expect(localStorage.getItem(CONSENT_KEY)).toBe('false');
    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect(w.get('[data-testid="telemetry-value"]').text()).toBe('Off');
  });
});
