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
  // S407: single shared router stubs so tests can OBSERVE navigation intent
  // (subtitle selection returns to the player; the audio refusal must NOT).
  routerBack: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => h.route,
  useRouter: () => ({ back: h.routerBack, push: h.routerPush }),
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
import AudioTracksPage, {
  AUDIO_TRACK_APPLY_UNSUPPORTED_UI_STORE,
} from '@/pages/AudioTracksPage.vue';
import SubtitleTracksPage from '@/pages/SubtitleTracksPage.vue';
import AudioTrackList from '@/components/AudioTrackList.vue';
import SubtitleTrackList from '@/components/SubtitleTrackList.vue';

beforeEach(() => {
  h.calls.length = 0;
  for (const k of Object.keys(h.responses)) delete h.responses[k];
  h.route.params = {};
  for (const k of Object.keys(h.player)) delete h.player[k];
  h.routerBack.mockReset();
  h.routerPush.mockReset();
});

// ── S407 golden rails ───────────────────────────────────────────────────────
// Values copied from contracts test/fixtures/stream-track-vectors.json @
// 068d5e86 (provenance server 01340633). Subtitle: case
// `embedded-text-codecs-bitmap-skipped-but-counted` (path-only urls; the
// signer's stripped `?exp=<digits>&sig=<base64url>` re-appended in the
// documented mint form). Audio: case
// `stored-default-on-second-nullables-passthrough`.
const S407_SUBTITLE_TRACKS = [
  {
    id: 'ss-1',
    index: 0,
    stream_index: 1,
    language: 'eng',
    label: 'eng',
    codec: 'subrip',
    source: null,
    hearing_impaired: true,
    url: '/api/v1/media/11111111-2222-3333-4444-555555555555/subtitles/0?exp=1800000000&sig=dGVzdC1zaWc',
  },
  {
    id: 'ss-2',
    index: 2,
    stream_index: 4,
    language: 'spa',
    label: 'Español (Forzada)',
    codec: 'mov_text',
    source: null,
    hearing_impaired: false,
    url: '/api/v1/media/11111111-2222-3333-4444-555555555555/subtitles/2?exp=1800000000&sig=dGVzdC1zaWc',
  },
];

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

  // S407 NAMED REFUSAL: the pre-S407 onSelectTrack duck-probed setAudioTrack/
  // switchAudioTrack/setAudioTrackId/hls on the store. NONE exist on the
  // vendored @phlix/ui#v0.99.0 store, so every probe missed, NOTHING applied,
  // and the page still `router.back()`d — a SILENT NO-OP (S406's phantom rail).
  // The AC forbids silent no-ops; this pins the page now STATES the boundary
  // and does NOT navigate away as if it had worked.
  it('S407: selecting an audio row surfaces the named refusal and does NOT back out', async () => {
    h.responses['/api/v1/media/m9/playback-info'] = {
      audio_tracks: [
        { id: 'as-1', index: 0, stream_index: 1, codec: 'eac3', language: 'en', channels: 6, bitrate: 640000, title: null, default: false },
        { id: 'as-2', index: 1, stream_index: 2, codec: 'aac', language: 'en', channels: 2, bitrate: 128000, title: 'Commentary', default: true },
      ],
    };
    const wrapper = mountPage('m9');
    await flushPromises();
    const rows = wrapper.findAllComponents(AudioTrackList);
    expect(rows).toHaveLength(1);
    const secondTrack = {
      id: 'as-2', index: 1, stream_index: 2, codec: 'aac', language: 'en',
      channels: 2, bitrate: 128000, title: 'Commentary', default: true,
    };
    // Call the handler the page wired via the rendered list's onSelect prop.
    (rows[0].props('onSelect') as (t: unknown) => void)(secondTrack);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain(AUDIO_TRACK_APPLY_UNSUPPORTED_UI_STORE);
    // NO silent success path: it must NOT navigate back pretending it applied.
    expect(h.routerBack).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});

// ── SubtitleTracksPage: S407 consumer, OBSERVABLE EFFECT arm ─────────────────
// The vendored @phlix/ui player store exposes setSubtitle(lang) + subtitleLang
// (dist/stores/usePlayerStore.d.ts; the ui Player consumes it at
// dist/player.js:4816 matching `track.language === subtitleLang`). So subtitle
// selection has a REAL observable effect and is tested through it — NOT refused.
// The UI BOUNDARY this page names: rows key on wire `id`, the store keys on
// LANGUAGE — this page resolves id→language on dispatch and language→(first
// matching)id for the active highlight.

describe('SubtitleTracksPage — S407 playback-info consumer (observable effect)', () => {
  // The fake store is a plain (non-reactive) object, so subtitleLang must be
  // set BEFORE mount — the computed reads it during the first render pass.
  const mountPage = (id: string, subtitleLang: string | null = null) => {
    h.route.params = { id };
    h.player.setSubtitle = vi.fn();
    h.player.subtitleLang = subtitleLang;
    return mount(SubtitleTracksPage, { attachTo: document.body });
  };

  it('fetches the shared playback-info rail and passes subtitle_tracks through verbatim', async () => {
    h.responses['/api/v1/media/m1/playback-info'] = { subtitle_tracks: S407_SUBTITLE_TRACKS };
    const wrapper = mountPage('m1');
    await flushPromises();
    // Same literal the audio page uses — ONE shared loader, no second copy.
    expect(h.calls).toEqual(['/api/v1/media/m1/playback-info']);
    const tracks = wrapper.findComponent(SubtitleTrackList).props('tracks');
    expect(tracks).toEqual(S407_SUBTITLE_TRACKS);
    wrapper.unmount();
  });

  it('renders the empty state (not a crash) when subtitle_tracks is missing', async () => {
    h.responses['/api/v1/media/m2/playback-info'] = { item_id: 'm2' };
    const wrapper = mountPage('m2');
    await flushPromises();
    expect(wrapper.text()).toContain('No subtitle tracks available');
    expect(wrapper.findComponent(SubtitleTrackList).exists()).toBe(false);
    wrapper.unmount();
  });

  it('selecting a track calls setSubtitle(LANGUAGE) — the observable effect — then backs out', async () => {
    h.responses['/api/v1/media/m3/playback-info'] = { subtitle_tracks: S407_SUBTITLE_TRACKS };
    const wrapper = mountPage('m3');
    await flushPromises();
    const list = wrapper.findComponent(SubtitleTrackList);
    // The picker is handed the page's own onSelect; invoke it with row 2 (spa).
    (list.props('onSelect') as (t: unknown) => void)(S407_SUBTITLE_TRACKS[1]);
    expect(h.player.setSubtitle).toHaveBeenCalledWith('spa');
    expect(h.routerBack).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('selecting "Off" (null) calls setSubtitle(null)', async () => {
    h.responses['/api/v1/media/m4/playback-info'] = { subtitle_tracks: S407_SUBTITLE_TRACKS };
    const wrapper = mountPage('m4');
    await flushPromises();
    const list = wrapper.findComponent(SubtitleTrackList);
    (list.props('onSelect') as (t: unknown) => void)(null);
    expect(h.player.setSubtitle).toHaveBeenCalledWith(null);
    wrapper.unmount();
  });

  it('derives activeTrackId by FIRST-MATCH language equality against subtitleLang', async () => {
    // Two rows share 'eng'; the store keys by language, so only the FIRST
    // matching wire id may claim the active highlight — this pins that rule.
    const dup = [
      { ...S407_SUBTITLE_TRACKS[0], id: 'eng-first' },
      { ...S407_SUBTITLE_TRACKS[0], id: 'eng-second' },
      S407_SUBTITLE_TRACKS[1],
    ];
    h.responses['/api/v1/media/m5/playback-info'] = { subtitle_tracks: dup };
    const wrapper = mountPage('m5', 'eng');
    await flushPromises();
    expect(wrapper.findComponent(SubtitleTrackList).props('activeTrackId')).toBe('eng-first');
    wrapper.unmount();
  });

  it('subtitleLang null → activeTrackId null (the "Off" row is active)', async () => {
    h.responses['/api/v1/media/m6/playback-info'] = { subtitle_tracks: S407_SUBTITLE_TRACKS };
    h.player.subtitleLang = null;
    const wrapper = mountPage('m6');
    await flushPromises();
    expect(wrapper.findComponent(SubtitleTrackList).props('activeTrackId')).toBeNull();
    wrapper.unmount();
  });

  it('subtitleLang with NO matching row → activeTrackId null (no fabricated active)', async () => {
    h.responses['/api/v1/media/m10/playback-info'] = { subtitle_tracks: S407_SUBTITLE_TRACKS };
    const wrapper = mountPage('m10', 'zxx-unmatched');
    await flushPromises();
    expect(wrapper.findComponent(SubtitleTrackList).props('activeTrackId')).toBeNull();
    wrapper.unmount();
  });
});
