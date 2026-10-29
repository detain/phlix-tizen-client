import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';

// Capture the opts passed to useSpatialNav so we can exercise the `enabled`
// getter against controllable route + prefs state.
const useSpatialNav = vi.fn();
const routeRef = { name: 'home' as string | symbol | null };
const prefsRef = { tv: true as boolean };
// The real ui module exports one shared Set; the host registers its candidate
// watcher against it (C27 / review tizen__gameux). Tests observe that same Set.
const focusableRegistry = new Set<HTMLElement>();

vi.mock('@phlix/ui', () => ({
  useSpatialNav: (...args: unknown[]) => useSpatialNav(...args),
  usePreferencesStore: vi.fn(() => prefsRef),
  // Getter, not value: the factory executes during import evaluation, before
  // the const above is initialized — access is deferred to component runtime.
  get focusableRegistry() {
    return focusableRegistry;
  }
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

/** MutationObserver callbacks arrive as microtasks; a macrotask tick drains them. */
function flushMutations(): Promise<void> {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

describe('SpatialNavHost', () => {
  // Every mounted host owns a candidate watcher on document.body; unmounting
  // them in afterEach stops observers leaking into sibling tests.
  const mounted: ReturnType<typeof mount>[] = [];

  function mountHost(): ReturnType<typeof mount> {
    const wrapper = mount(SpatialNavHost);
    mounted.push(wrapper);
    return wrapper;
  }

  beforeEach(() => {
    useSpatialNav.mockClear();
    routeRef.name = 'home';
    prefsRef.tv = true;
    qualityMenuActive.value = false;
  });

  afterEach(() => {
    for (const wrapper of mounted.splice(0)) {
      wrapper.unmount();
    }
    document.body.innerHTML = '';
    focusableRegistry.clear();
  });

  it('renders renderless (hidden) and registers spatial-nav', () => {
    const wrapper = mountHost();
    expect(useSpatialNav).toHaveBeenCalledTimes(1);
    expect(wrapper.html()).toContain('display: none');
  });

  it('enables spatial-nav on a browse route when tv mode is on', () => {
    prefsRef.tv = true;
    routeRef.name = 'home';
    mountHost();
    expect(getEnabled()()).toBe(true);
  });

  it('disables spatial-nav on the player route', () => {
    prefsRef.tv = true;
    routeRef.name = 'player';
    mountHost();
    expect(getEnabled()()).toBe(false);
  });

  it('disables spatial-nav when tv mode is off', () => {
    prefsRef.tv = false;
    routeRef.name = 'home';
    mountHost();
    expect(getEnabled()()).toBe(false);
  });

  it('disables spatial-nav while quality-selection mode is active', () => {
    prefsRef.tv = true;
    routeRef.name = 'home';
    mountHost();
    const enabled = getEnabled();
    expect(enabled()).toBe(true);
    qualityMenuActive.value = true;
    expect(enabled()).toBe(false);
  });

  it('keeps the ui candidate registry populated from the live document', async () => {
    // C27 / review tizen__gameux: an empty registry made every D-pad keypress
    // a no-op. A surface element must reach the engine's pool while mounted.
    const button = document.createElement('button');
    document.body.appendChild(button);

    const wrapper = mountHost();
    expect(focusableRegistry.has(button)).toBe(true);
    expect(button.getAttribute('data-focusable')).toBe('auto');

    // The pool responds to DOM churn on a live surface…
    const link = document.createElement('a');
    link.href = '#/browse';
    document.body.appendChild(link);
    await flushMutations();
    expect(focusableRegistry.has(link)).toBe(true);

    button.remove();
    await flushMutations();
    expect(focusableRegistry.has(button)).toBe(false);

    // …and everything shell-registered is released when the host unmounts.
    wrapper.unmount();
    expect(focusableRegistry.has(link)).toBe(false);
    expect(link.hasAttribute('data-focusable')).toBe(false);
  });
});
