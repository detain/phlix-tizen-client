import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';

// Capture the opts passed to useSpatialNav so we can exercise the `enabled`
// getter against controllable route + prefs state.
const useSpatialNav = vi.fn();
const routeRef = { name: 'home' as string | symbol | null };
const prefsRef = { tv: true as boolean };

vi.mock('@phlix/ui', () => ({
  useSpatialNav: (...args: unknown[]) => useSpatialNav(...args),
  usePreferencesStore: vi.fn(() => prefsRef)
}));

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => routeRef)
}));

import SpatialNavHost from '@/SpatialNavHost.vue';
import { qualityMenuActive } from '@/tizenBridge';

function getEnabled(): () => boolean {
  const opts = useSpatialNav.mock.calls[0][0] as { enabled: () => boolean };
  return opts.enabled;
}

describe('SpatialNavHost', () => {
  beforeEach(() => {
    useSpatialNav.mockClear();
    routeRef.name = 'home';
    prefsRef.tv = true;
    qualityMenuActive.value = false;
  });

  it('renders renderless (hidden) and registers spatial-nav', () => {
    const wrapper = mount(SpatialNavHost);
    expect(useSpatialNav).toHaveBeenCalledTimes(1);
    expect(wrapper.html()).toContain('display: none');
  });

  it('enables spatial-nav on a browse route when tv mode is on', () => {
    prefsRef.tv = true;
    routeRef.name = 'home';
    mount(SpatialNavHost);
    expect(getEnabled()()).toBe(true);
  });

  it('disables spatial-nav on the player route', () => {
    prefsRef.tv = true;
    routeRef.name = 'player';
    mount(SpatialNavHost);
    expect(getEnabled()()).toBe(false);
  });

  it('disables spatial-nav when tv mode is off', () => {
    prefsRef.tv = false;
    routeRef.name = 'home';
    mount(SpatialNavHost);
    expect(getEnabled()()).toBe(false);
  });

  it('disables spatial-nav while quality-selection mode is active', () => {
    prefsRef.tv = true;
    routeRef.name = 'home';
    mount(SpatialNavHost);
    const enabled = getEnabled();
    expect(enabled()).toBe(true);
    qualityMenuActive.value = true;
    expect(enabled()).toBe(false);
  });
});
