/**
 * Track-language memory — page wiring (S511 / AD-18).
 *
 * The pure resolver and the settings store are covered in their own files;
 * this one proves the two pages actually CONSUME them, and do so honestly:
 *
 *   - SubtitleTracksPage can apply a subtitle language for real, so it must
 *     (a) adopt the remembered language on load ONLY when the viewer has not
 *     chosen yet this session (adopt-once), (b) leave the store untouched when
 *     no preference matches (AC2 byte-identical), and (c) persist a real pick
 *     through the existing settings PUT (AC3).
 *   - AudioTracksPage CANNOT apply audio live (the S407 named refusal stands),
 *     so selecting must keep showing that exact refusal WHILE also remembering
 *     the choice (per-item + account PUT) and surfacing the preference — the
 *     memory half of AD-18 works even where the apply half does not.
 *
 * @phlix/ui is mocked at its boundary (ApiClient + the two composables the
 * pages reach for); the store's account calls and the playback-info rail share
 * the one ApiClient, routed here by URL.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SubtitleTracksPage from '@/pages/SubtitleTracksPage.vue';
import AudioTracksPage, {
  AUDIO_TRACK_APPLY_UNSUPPORTED_UI_STORE,
} from '@/pages/AudioTracksPage.vue';
import SubtitleTrackList from '@/components/SubtitleTrackList.vue';
import AudioTrackList from '@/components/AudioTrackList.vue';
import { useTrackPreferenceStore } from '@/stores/useTrackPreferenceStore';

const MEDIA_ID = 'media-77';

const calls: { method: string; url: string; body?: unknown }[] = [];
const playerState = {
  subtitleLang: null as string | null,
  setSubtitle: vi.fn((lang: string | null) => {
    playerState.subtitleLang = lang;
  }),
};

let settingsBody: unknown = { settings: {} };
let playbackBody: unknown = { audio_tracks: [], subtitle_tracks: [] };

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: MEDIA_ID } }),
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock('@phlix/ui', () => ({
  useApiBase: () => ({ value: 'http://server.test' }),
  usePlayerStore: () => playerState,
  ApiClient: class {
    constructor(_opts: unknown) {}
    async get<T = unknown>(url: string): Promise<T> {
      calls.push({ method: 'GET', url });
      if (url.endsWith('/users/me/settings')) return settingsBody as T;
      if (url.includes('/playback-info')) return playbackBody as T;
      throw new Error('unexpected GET ' + url);
    }
    async put<T = unknown>(url: string, body?: unknown): Promise<T> {
      calls.push({ method: 'PUT', url, body });
      return { message: 'Settings updated' } as T;
    }
  },
}));

function subtitleRow(id: string, language: string): unknown {
  return {
    id,
    index: 0,
    stream_index: 0,
    language,
    label: null,
    codec: 'subrip',
    source: 'embedded',
    hearing_impaired: false,
    url: null,
  };
}

function audioRow(id: string, language: string): unknown {
  return {
    id,
    index: 0,
    stream_index: 0,
    codec: 'aac',
    language,
    channels: 2,
    bitrate: null,
    title: null,
    default: false,
  };
}

describe('SubtitleTracksPage — adopts + persists the remembered subtitle language (S511)', () => {
  beforeEach(() => {
    calls.length = 0;
    playerState.subtitleLang = null;
    playerState.setSubtitle.mockClear();
    settingsBody = { settings: {} };
    globalThis.localStorage.clear();
  });

  it('adopts the account preference on load when the viewer has not chosen (AC1 ladder read)', async () => {
    playbackBody = { subtitle_tracks: [subtitleRow('s1', 'eng'), subtitleRow('s2', 'spa')] };
    settingsBody = { settings: { preferred_subtitle_language: 'spa' } };

    mount(SubtitleTracksPage, { global: { plugins: [createPinia()] } });
    await flushPromises();

    expect(playerState.subtitleLang).toBe('spa');
    // The adoption is a real store dispatch, and it read the account settings.
    expect(calls.some((c) => c.method === 'GET' && c.url.endsWith('/users/me/settings'))).toBe(true);
  });

  it('per-item memory beats the account preference on load', async () => {
    playbackBody = { subtitle_tracks: [subtitleRow('s1', 'eng'), subtitleRow('s2', 'spa')] };
    settingsBody = { settings: { preferred_subtitle_language: 'eng' } };
    // Seed the per-item memory through the store's OWN writer (guarantees the
    // localStorage key format matches what the page reads back), then mount —
    // the pinia store instance is per-mount but the storage slot is global.
    setActivePinia(createPinia());
    useTrackPreferenceStore().setPerItem(MEDIA_ID, 'subtitle', 'spa');

    mount(SubtitleTracksPage, { global: { plugins: [createPinia()] } });
    await flushPromises();

    expect(playerState.subtitleLang).toBe('spa');
  });

  it('does NOT overwrite a choice already made this session (adopt-once)', async () => {
    playbackBody = { subtitle_tracks: [subtitleRow('s1', 'eng'), subtitleRow('s2', 'spa')] };
    settingsBody = { settings: { preferred_subtitle_language: 'spa' } };
    // Viewer already toggled subtitles to English before this page mounted.
    playerState.subtitleLang = 'eng';

    mount(SubtitleTracksPage, { global: { plugins: [createPinia()] } });
    await flushPromises();

    expect(playerState.subtitleLang).toBe('eng');
    expect(playerState.setSubtitle).not.toHaveBeenCalled();
  });

  it('leaves subtitles untouched when no preference matches (AC2 byte-identical)', async () => {
    playbackBody = { subtitle_tracks: [subtitleRow('s1', 'eng')] };
    settingsBody = { settings: { preferred_subtitle_language: 'kor' } }; // item has no Korean

    mount(SubtitleTracksPage, { global: { plugins: [createPinia()] } });
    await flushPromises();

    expect(playerState.subtitleLang).toBeNull();
    expect(playerState.setSubtitle).not.toHaveBeenCalled();
  });

  it('persisting a pick issues the existing settings PUT with only the subtitle field (AC3)', async () => {
    playbackBody = { subtitle_tracks: [subtitleRow('s1', 'eng'), subtitleRow('s2', 'fra')] };
    const wrapper = mount(SubtitleTracksPage, { global: { plugins: [createPinia()] } });
    await flushPromises();

    const select = wrapper.findComponent(SubtitleTrackList).props('onSelect') as (
      t: unknown,
    ) => void;
    select(subtitleRow('s2', 'fra'));
    await flushPromises();

    expect(playerState.subtitleLang).toBe('fra');
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([
      {
        method: 'PUT',
        url: '/api/v1/users/me/settings',
        body: { preferred_subtitle_language: 'fra' },
      },
    ]);
  });

  it('turning subtitles OFF dispatches null and persists nothing (off is not a preference)', async () => {
    playbackBody = { subtitle_tracks: [subtitleRow('s1', 'eng')] };
    const wrapper = mount(SubtitleTracksPage, { global: { plugins: [createPinia()] } });
    await flushPromises();

    const select = wrapper.findComponent(SubtitleTrackList).props('onSelect') as (
      t: unknown,
    ) => void;
    select(null);
    await flushPromises();

    expect(playerState.subtitleLang).toBeNull();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });
});

describe('AudioTracksPage — remembers the audio language despite the live-apply refusal (S511)', () => {
  beforeEach(() => {
    calls.length = 0;
    settingsBody = { settings: {} };
    globalThis.localStorage.clear();
  });

  it('surfacing the preferred audio language on load marks the ladder result (AC1)', async () => {
    playbackBody = { audio_tracks: [audioRow('a1', 'eng'), audioRow('a2', 'spa')] };
    settingsBody = { settings: { preferred_audio_language: 'spa' } };

    const wrapper = mount(AudioTracksPage, { global: { plugins: [createPinia()] } });
    await flushPromises();

    expect(wrapper.find('.audio-tracks-page__preferred').text()).toContain('spa');
  });

  it('selecting keeps the S407 named refusal byte-identical (boundary honesty)', async () => {
    playbackBody = { audio_tracks: [audioRow('a1', 'eng')] };
    const wrapper = mount(AudioTracksPage, { global: { plugins: [createPinia()] } });
    await flushPromises();

    const select = wrapper.findComponent(AudioTrackList).props('onSelect') as (
      t: unknown,
    ) => void;
    select(audioRow('a1', 'eng'));
    await flushPromises();

    expect(wrapper.find('.audio-tracks-page__refusal').text()).toBe(
      AUDIO_TRACK_APPLY_UNSUPPORTED_UI_STORE,
    );
  });

  it('selecting still REMEMBERS the choice — per-item PUT with only the audio field (AC3)', async () => {
    playbackBody = { audio_tracks: [audioRow('a1', 'eng'), audioRow('a2', 'jpn')] };
    const wrapper = mount(AudioTracksPage, { global: { plugins: [createPinia()] } });
    await flushPromises();

    const select = wrapper.findComponent(AudioTrackList).props('onSelect') as (
      t: unknown,
    ) => void;
    select(audioRow('a2', 'jpn'));
    await flushPromises();

    expect(wrapper.find('.audio-tracks-page__saved').exists()).toBe(true);
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([
      {
        method: 'PUT',
        url: '/api/v1/users/me/settings',
        body: { preferred_audio_language: 'jpn' },
      },
    ]);
  });

  it('no preference on load → no marker (AC2 unchanged)', async () => {
    playbackBody = { audio_tracks: [audioRow('a1', 'eng')] };
    settingsBody = { settings: { preferred_audio_language: 'kor' } };

    const wrapper = mount(AudioTracksPage, { global: { plugins: [createPinia()] } });
    await flushPromises();

    expect(wrapper.find('.audio-tracks-page__preferred').exists()).toBe(false);
    expect(wrapper.find('.audio-tracks-page__saved').exists()).toBe(false);
  });
});
