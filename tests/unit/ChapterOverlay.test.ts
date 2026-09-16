/**
 * ChapterOverlay.test — S501 T-05/T-07 runtime pins for the surviving overlays.
 *
 * Two defect classes the W105 audit found live only in this kind of long-lived
 * root app (mounted once for the whole TV session, never unmounted):
 *
 *   T-05 — the 250 ms player-position poll ran for the entire app lifetime,
 *          burning CPU on the TV webview even while the viewer was browsing with
 *          no media open. Fix: the poll starts only while a player route
 *          (`route.params.id`) is active and stops when it clears (and on the
 *          corrected `onBeforeUnmount` hook). Pins use `vi.getTimerCount()` so
 *          they assert the REAL pending-timer state (no spy accumulation).
 *
 *   T-07 — `loadChapters`/`loadMarkers` awaited a per-media request then wrote
 *          the result unconditionally, so a rapid media change could let a SLOW
 *          reply for the PREVIOUS title clobber the CURRENT title's data. Fix: a
 *          generation counter drops any superseded reply. Pins resolve the two
 *          in-flight loads out of order and assert the stale one never lands.
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
  /** URL → deferred so a test can resolve two in-flight loads in ANY order. */
  pending: {} as Record<string, { promise: Promise<unknown>; resolve: (v: unknown) => void }>,
  player: {} as Record<string, unknown>,
}));

// Reactive route holder: reassigning `.params` notifies `computed(() => route
// .params.id)` + its `watch` — the exact enter/leave-a-player-route signal that
// gates the poll. Read only inside the useRoute() thunk (at mount), so module
// init order is safe.
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

import ChapterOverlay from '@/components/ChapterOverlay.vue';

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

describe('ChapterOverlay — T-05 poll runs only inside the player window', () => {
  it('starts NO position poll while off a player route (no media id)', async () => {
    routeHolder.params = {};
    const base = vi.getTimerCount();
    const wrapper = mount(ChapterOverlay, { attachTo: document.body });
    await flushPromises();

    expect(vi.getTimerCount()).toBe(base); // nothing scheduled
    expect(h.calls).toEqual([]); // nothing fetched without a media id
    wrapper.unmount();
  });

  it('starts exactly one 250 ms position poll while on a player route', async () => {
    routeHolder.params = { id: 'm1' };
    const base = vi.getTimerCount();
    const wrapper = mount(ChapterOverlay, { attachTo: document.body });
    await flushPromises();

    expect(vi.getTimerCount()).toBe(base + 1);
    expect(h.calls).toContain('/api/v1/media/m1/chapters');
    wrapper.unmount();
  });

  it('stops the poll when leaving the player route (media id clears)', async () => {
    routeHolder.params = { id: 'm1' };
    const base = vi.getTimerCount();
    const wrapper = mount(ChapterOverlay, { attachTo: document.body });
    await flushPromises();
    expect(vi.getTimerCount()).toBe(base + 1);

    routeHolder.params = {}; // navigate to a non-player route
    await wrapper.vm.$nextTick();
    expect(vi.getTimerCount()).toBe(base); // the watch cleared it
    wrapper.unmount();
  });

  it('clears the poll on unmount via onBeforeUnmount (the hook that actually fires)', async () => {
    routeHolder.params = { id: 'm1' };
    const base = vi.getTimerCount();
    const wrapper = mount(ChapterOverlay, { attachTo: document.body });
    await flushPromises();
    expect(vi.getTimerCount()).toBe(base + 1);

    wrapper.unmount();
    expect(vi.getTimerCount()).toBe(base);
  });
});

describe('ChapterOverlay — T-07 stale-load generation guard', () => {
  it('drops a superseded markers reply so a slow previous title cannot add phantom ticks', async () => {
    h.player.duration = 360; // supplies currentDuration on the first poll tick
    h.player.position = 0;
    routeHolder.params = { id: 'm1' };
    h.pending['/api/v1/media/m1/chapters'] = deferred();
    h.pending['/api/v1/media/m1/markers'] = deferred();
    h.pending['/api/v1/media/m2/chapters'] = deferred();
    h.pending['/api/v1/media/m2/markers'] = deferred();

    const wrapper = mount(ChapterOverlay, { attachTo: document.body });
    await flushPromises(); // issues m1 loads (gen 1)

    routeHolder.params = { id: 'm2' }; // switch media mid-flight
    await flushPromises(); // issues m2 loads (gen 2)

    // Newest (m2) first: ONE marker tick.
    h.pending['/api/v1/media/m2/markers'].resolve({
      markers: [{ id: 'mk2', type: 'ad', startMs: 1000, endMs: 2000, label: 'Ad' }],
    });
    h.pending['/api/v1/media/m2/chapters'].resolve({ chapters: [] });
    await flushPromises();

    // Stale (m1) LAST: THREE markers — the pre-fix bug appended these.
    h.pending['/api/v1/media/m1/markers'].resolve({
      markers: [
        { id: 'a', type: 'ad', startMs: 100, endMs: 200, label: 'A' },
        { id: 'b', type: 'ad', startMs: 300, endMs: 400, label: 'B' },
        { id: 'c', type: 'ad', startMs: 500, endMs: 600, label: 'C' },
      ],
    });
    h.pending['/api/v1/media/m1/chapters'].resolve({ chapters: [] });
    await flushPromises();

    // One poll tick sets currentDuration so the (duration-gated) ticks render.
    vi.advanceTimersByTime(250);
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('.chapter-overlay__tick')).toHaveLength(1);
    // Both titles were requested — the guard drops the WRITE, not the fetch.
    expect(h.calls).toContain('/api/v1/media/m1/markers');
    expect(h.calls).toContain('/api/v1/media/m2/markers');

    wrapper.unmount();
  });

  it('drops a superseded chapters reply (verified through one poll tick)', async () => {
    h.player.duration = 360;
    h.player.position = 0;
    routeHolder.params = { id: 'm1' };
    h.pending['/api/v1/media/m1/chapters'] = deferred();
    h.pending['/api/v1/media/m1/markers'] = deferred();
    h.pending['/api/v1/media/m2/chapters'] = deferred();
    h.pending['/api/v1/media/m2/markers'] = deferred();

    const wrapper = mount(ChapterOverlay, { attachTo: document.body });
    await flushPromises();
    routeHolder.params = { id: 'm2' };
    await flushPromises();

    // Newest: one chapter. Stale (resolved last): three chapters.
    h.pending['/api/v1/media/m2/chapters'].resolve({
      chapters: [{ index: 0, startSeconds: 10, endSeconds: 20, title: 'M2 Chapter', closedCaptions: null }],
    });
    h.pending['/api/v1/media/m2/markers'].resolve({ markers: [] });
    await flushPromises();
    h.pending['/api/v1/media/m1/chapters'].resolve({
      chapters: [
        { index: 0, startSeconds: 0, endSeconds: 5, title: 'Stale A', closedCaptions: null },
        { index: 1, startSeconds: 5, endSeconds: 9, title: 'Stale B', closedCaptions: null },
        { index: 2, startSeconds: 9, endSeconds: 12, title: 'Stale C', closedCaptions: null },
      ],
    });
    h.pending['/api/v1/media/m1/markers'].resolve({ markers: [] });
    await flushPromises();

    vi.advanceTimersByTime(250);
    await wrapper.vm.$nextTick();

    const titles = wrapper.findAll('.chapter-overlay__tick').map((t) => t.attributes('title'));
    expect(titles).toEqual(['M2 Chapter']);
    wrapper.unmount();
  });
});
