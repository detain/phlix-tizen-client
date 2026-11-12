import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('vue-router', () => ({ useRouter: () => ({ back: vi.fn() }) }));

import TvSettingsPage from '../../src/pages/TvSettingsPage.vue';
import { IDLE_TIMEOUT_KEY } from '../../src/screensaver';

describe('TvSettingsPage (TIZ-S16)', () => {
  beforeEach(() => localStorage.clear());

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
});
