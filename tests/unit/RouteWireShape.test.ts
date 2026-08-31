/**
 * RouteWireShape.test — S280 pins the two production fixes' WIRE handling.
 *
 * The route gate (routeManifest.gate.test.ts) proves the tizen client calls
 * SERVED rails. This file pins the harder half: that the two rails it moved
 * ONTO are READ with the shape the SERVER actually emits —
 *   - UpNextOverlay   → GET /api/v1/users/me/next-up       ({items:[…]} — WebPortalRouter::getNextUp)
 *   - AudioTracksPage → GET /api/v1/media/{id}/playback-info ({audio_tracks:[…]} — StreamTrackShaper)
 * Both components previously fetched never-registered routes, so this
 * envelope handling is newly-live code. A future re-widening (wrong key, a
 * self-item shown as its own "up next", a null `bitrate`/`title` shipped onto
 * a StreamAudioTrack) reddens HERE instead of shipping a silently-empty TV
 * overlay — mirroring the S325b ParentalControlsWireShape precedent.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

// All mutable harness state is hoisted so the vi.mock factories (hoisted
// above imports by vitest) can close over it. Plain objects (not `reactive`)
// because vi.hoisted runs BEFORE imports — only params known at mount time
// are read, and every test sets them before mounting.
const h = vi.hoisted(() => ({
  calls: [] as string[],
  /** URL → canned server response. Unknown URL → `{}` (fail toward empty). */
  responses: {} as Record<string, unknown>,
  route: { params: {} as Record<string, string> },
  player: {} as Record<string, unknown>,
}));

vi.mock('vue-router', () => ({
  useRoute: () => h.route,
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

vi.mock('@phlix/ui', () => ({
  useApiBase: () => ({ value: 'https://api.example.com' }),
  usePlayerStore: () => h.player,
  ApiClient: vi.fn().mockImplementation(() => ({
    get: vi.fn(async (url: string) => {
      h.calls.push(url);
      return h.responses[url] ?? {};
    }),
  })),
}));

import UpNextOverlay from '@/components/UpNextOverlay.vue';
import AudioTracksPage from '@/pages/AudioTracksPage.vue';
import AudioTrackList from '@/components/AudioTrackList.vue';

beforeEach(() => {
  h.calls.length = 0;
  for (const k of Object.keys(h.responses)) delete h.responses[k];
  h.route.params = {};
  for (const k of Object.keys(h.player)) delete h.player[k];
});

// ── UpNextOverlay: /api/v1/users/me/next-up head-selection ──────────────────

describe('UpNextOverlay — next-up rail wire shape (S280)', () => {
  /** Route at the 8-seconds-from-end window so a set upNextMedia renders. */
  const mountNearEnd = (currentId: string) => {
    h.route.params = { id: currentId };
    h.player.position = 352;
    h.player.duration = 360;
    return mount(UpNextOverlay, {
      props: { counting: true, remaining: 8, total: 8 },
      attachTo: document.body,
    });
  };

  it('fetches the registered /api/v1/users/me/next-up rail', async () => {
    h.responses['/api/v1/users/me/next-up'] = { items: [] };
    const wrapper = mountNearEnd('media-123');
    await flushPromises();
    expect(h.calls).toEqual(['/api/v1/users/me/next-up']);
    // Nothing up next → the overlay never renders (no fabricated card).
    expect(wrapper.html()).toBe('<!--v-if-->');
    wrapper.unmount();
  });

  it('selects the first NON-current item, skipping a self pick', async () => {
    // Defensive against a not-yet-positioned self-entry (NextUpSelector can
    // classify a zero-position started episode as fresh): it must never be
    // shown as its own "up next".
    h.responses['/api/v1/users/me/next-up'] = {
      items: [
        { id: 'media-123', name: 'Self' },
        { id: 'next-a', name: 'Next A' },
        { id: 'next-b', name: 'Next B' },
      ],
    };
    const wrapper = mountNearEnd('media-123');
    await flushPromises();
    // Visibility is driven by the component's 250ms player-position poll
    // (initial duration is 0 → hidden); cross one real tick.
    await new Promise((resolve) => setTimeout(resolve, 350));
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Next A');
    expect(wrapper.text()).not.toContain('Self');
    expect(wrapper.text()).not.toContain('Next B');
    wrapper.unmount();
  });

  it('renders nothing when the envelope omits items (older server)', async () => {
    h.responses['/api/v1/users/me/next-up'] = {};
    const wrapper = mountNearEnd('media-123');
    await flushPromises();
    expect(wrapper.html()).toBe('<!--v-if-->');
    wrapper.unmount();
  });
});

// ── AudioTracksPage: playback-info audio_tracks[] mapping ───────────────────

describe('AudioTracksPage — playback-info wire shape (S280)', () => {
  const mountPage = (id: string) => {
    h.route.params = { id };
    // No player-store tracks → the page must take the playback-info fallback.
    return mount(AudioTracksPage, { attachTo: document.body });
  };

  it('calls /api/v1/media/{id}/playback-info and passes audio_tracks through as the wire AudioTrack shape', async () => {
    h.responses['/api/v1/media/m7/playback-info'] = {
      audio_tracks: [
        { id: 'a1', index: 0, stream_index: 1, codec: 'aac', language: 'en', channels: 2, bitrate: null, title: null, default: true },
        { id: 'a2', index: 1, stream_index: 2, codec: 'eac3', language: 'es', channels: 6, bitrate: 640000, title: 'Cast', default: false },
      ],
    };
    const wrapper = mountPage('m7');
    await flushPromises();
    expect(h.calls).toEqual(['/api/v1/media/m7/playback-info']);
    const tracks = wrapper.findComponent(AudioTrackList).props('tracks');
    // S404: the page types the rows as the playback-info WIRE AudioTrack
    // (contracts v0.4.5), so all nine StreamTrackShaper keys pass through —
    // the pre-S404 hand-map DISCARDED index/stream_index/default to coerce
    // rows into the StreamAudioTrack DB mirror; that discard was the defect
    // this alignment removes. Exact deep equality still guards the shape.
    expect(tracks).toEqual([
      { id: 'a1', index: 0, stream_index: 1, codec: 'aac', language: 'en', channels: 2, bitrate: null, title: null, default: true },
      { id: 'a2', index: 1, stream_index: 2, codec: 'eac3', language: 'es', channels: 6, bitrate: 640000, title: 'Cast', default: false },
    ]);
    wrapper.unmount();
  });

  it('renders the empty state (not a crash) when audio_tracks is missing', async () => {
    h.responses['/api/v1/media/m8/playback-info'] = { item_id: 'm8' };
    const wrapper = mountPage('m8');
    await flushPromises();
    expect(wrapper.text()).toContain('No alternative audio tracks available');
    wrapper.unmount();
  });
});
