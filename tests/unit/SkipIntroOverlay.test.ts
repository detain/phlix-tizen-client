/**
 * SkipIntroOverlay.test — S501 T-05/T-07 runtime pins for the skip-intro overlay.
 *
 * Same two defect classes as ChapterOverlay (both are long-lived root apps that
 * never unmount on a TV):
 *   T-05 — the 250 ms position poll is now gated to the player-route window and
 *          cleaned up on `onBeforeUnmount` instead of a never-firing `onUnmounted`.
 *          Pins assert the real pending-timer count via `vi.getTimerCount()`.
 *   T-07 — `loadMarkers` now drops a reply superseded by a newer media load, so
 *          zapping between titles cannot show the previous title's skip button.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';

const h = vi.hoisted(() => ({
  calls: [] as string[],
  responses: {} as Record<string, unknown>,
  pending: {} as Record<string, { promise: Promise<unknown>; resolve: (v: unknown) => void }>,
  player: {} as Record<string, unknown>,
}));

const routeHolder = reactive({ params: {} as Record<string, string> });

vi.mock('vue-router', () => ({
  useRoute: () => routeHolder,
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

vi.mock('@phlix/ui', () => ({
  useApiBase: () => ({ value: 'https://api.example.com' }),
  usePlayerStore: () => h.player,
  ApiClient: vi.fn(function () {
    return {
      get: vi.fn(async (url: string) => {
        h.calls.push(url);
        if (h.pending[url]) return h.pending[url].promise;
        return h.responses[url] ?? {};
      }),
    };
  }),
}));

import SkipIntroOverlay from '@/components/SkipIntroOverlay.vue';

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllTimers(); // wipe any timer leaked by a prior test's still-mounted wrapper
  h.calls.length = 0;
  for (const k of Object.keys(h.responses)) delete h.responses[k];
  for (const k of Object.keys(h.pending)) delete h.pending[k];
  for (const k of Object.keys(h.player)) delete h.player[k];
  routeHolder.params = {};
});

afterEach(() => {
  vi.useRealTimers();
});

function deferred() {
  let resolve!: (v: unknown) => void;
  const promise = new Promise<unknown>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('SkipIntroOverlay — T-05 poll runs only inside the player window', () => {
  it('starts NO position poll while off a player route', async () => {
    routeHolder.params = {};
    const base = vi.getTimerCount();
    const wrapper = mount(SkipIntroOverlay, { attachTo: document.body });
    await flushPromises();

    expect(vi.getTimerCount()).toBe(base);
    expect(h.calls).toEqual([]);
    wrapper.unmount();
  });

  it('starts exactly one 250 ms position poll while on a player route', async () => {
    routeHolder.params = { id: 'm1' };
    const base = vi.getTimerCount();
    const wrapper = mount(SkipIntroOverlay, { attachTo: document.body });
    await flushPromises();

    expect(vi.getTimerCount()).toBe(base + 1);
    expect(h.calls).toContain('/api/v1/media/m1/markers');
    wrapper.unmount();
  });

  it('stops the poll when leaving the player route (media id clears)', async () => {
    routeHolder.params = { id: 'm1' };
    const base = vi.getTimerCount();
    const wrapper = mount(SkipIntroOverlay, { attachTo: document.body });
    await flushPromises();
    expect(vi.getTimerCount()).toBe(base + 1);

    routeHolder.params = {};
    await wrapper.vm.$nextTick();
    expect(vi.getTimerCount()).toBe(base);
    wrapper.unmount();
  });

  it('clears the poll on unmount via onBeforeUnmount', async () => {
    routeHolder.params = { id: 'm1' };
    const base = vi.getTimerCount();
    const wrapper = mount(SkipIntroOverlay, { attachTo: document.body });
    await flushPromises();
    expect(vi.getTimerCount()).toBe(base + 1);

    wrapper.unmount();
    expect(vi.getTimerCount()).toBe(base);
  });
});

describe('SkipIntroOverlay — T-07 stale-load generation guard', () => {
  it('positive control: the CURRENT title’s intro marker renders the Skip Intro button', async () => {
    // Set the canned response BEFORE mount — onMounted calls get() synchronously.
    h.responses['/api/v1/media/solo/markers'] = {
      markers: [],
      introMarker: { id: 'in', type: 'intro', startMs: 0, endMs: 5000, label: 'Intro' },
      outroMarker: null,
    };
    routeHolder.params = { id: 'solo' };
    const wrapper = mount(SkipIntroOverlay, { attachTo: document.body });
    await flushPromises();

    expect(wrapper.find('.skip-intro-overlay__button--intro').exists()).toBe(true);
    wrapper.unmount();
  });

  it('does NOT resurrect the previous title’s skip button when its reply lands last', async () => {
    routeHolder.params = { id: 'm1' };
    h.pending['/api/v1/media/m1/markers'] = deferred();
    h.pending['/api/v1/media/m2/markers'] = deferred();

    const wrapper = mount(SkipIntroOverlay, { attachTo: document.body });
    await flushPromises(); // m1 load (gen 1)

    routeHolder.params = { id: 'm2' }; // switch to a title with NO markers
    await flushPromises(); // m2 load (gen 2)

    // Newest (m2) has nothing → the overlay must be empty.
    h.pending['/api/v1/media/m2/markers'].resolve({ markers: [], introMarker: null, outroMarker: null });
    await flushPromises();

    // Stale (m1) resolves LAST with a visible intro — the pre-fix bug would show it.
    h.pending['/api/v1/media/m1/markers'].resolve({
      markers: [],
      introMarker: { id: 'in-1', type: 'intro', startMs: 0, endMs: 5000, label: 'Intro' },
      outroMarker: null,
    });
    await flushPromises();

    // Guard held → the stale intro never drives a button.
    expect(wrapper.find('.skip-intro-overlay').exists()).toBe(false);
    wrapper.unmount();
  });
});
