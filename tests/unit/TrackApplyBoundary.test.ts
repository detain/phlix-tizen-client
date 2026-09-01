/**
 * TrackApplyBoundary — S407 premise pins against the REAL vendored store.
 *
 * S407 split the tizen track pickers into two arms, each justified by a claim
 * about `@phlix/ui#v0.99.0`'s player store (dist/stores/usePlayerStore.d.ts,
 * consumed by the ui Player at dist/player.js):
 *
 *   - AUDIO = NAMED REFUSAL, because the store exposes NO audio-track surface:
 *     no audio state, no switching action, and no `hls` instance — only
 *     `hlsMasterUrl`. The pre-S407 page duck-probed exactly those absent names
 *     and silently no-op'd (S406's phantom-rail class).
 *   - SUBTITLE = OBSERVABLE EFFECT, because `setSubtitle(lang)` + `subtitleLang`
 *     genuinely exist and the ui Player matches textTracks on the language.
 *
 * This file mounts NO mocks of `@phlix/ui` — it instantiates the REAL store so
 * both premises are pinned against the shipped dependency. If ui ever grows a
 * real audio-track action (or drops setSubtitle), the matching assertion goes
 * RED here, and the refusal/observable arms must be re-decided — exactly the
 * mobile NativeAudioSelectionBoundary.test.ts tripwire pattern.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { usePlayerStore } from '@phlix/ui';
import { AUDIO_TRACK_APPLY_UNSUPPORTED_UI_STORE } from '@/pages/AudioTracksPage.vue';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('S407 audio-refusal premise — the real store has NO audio surface', () => {
  it('none of the pre-S407 duck-probe names exist on the store', () => {
    const store = usePlayerStore() as unknown as Record<string, unknown>;
    // Every name the deleted onSelectTrack probe reached for:
    for (const absent of [
      'setAudioTrack',
      'switchAudioTrack',
      'setAudioTrackId',
      'audioTracks',
      'audioTrackId',
      'activeAudioTrack',
      'currentAudioTrackId',
      'hls',
    ]) {
      expect(store[absent], `store.${absent} must stay absent while the refusal ships`).toBeUndefined();
    }
  });

  it('only the HLS MASTER URL exists — no instance to poke `.audioTrack` on', () => {
    const store = usePlayerStore() as unknown as Record<string, unknown>;
    // hlsMasterUrl is a plain string slot — the probe `hls.audioTrack = i`
    // needed an INSTANCE. Pin that what exists is not an object.
    const master = store.hlsMasterUrl;
    expect(master === null || master === undefined || typeof master === 'string').toBe(true);
  });

  it('the refusal reason is exported and non-empty (no silent no-op path exists)', () => {
    expect(typeof AUDIO_TRACK_APPLY_UNSUPPORTED_UI_STORE).toBe('string');
    expect(AUDIO_TRACK_APPLY_UNSUPPORTED_UI_STORE.length).toBeGreaterThan(0);
  });
});

describe('S407 subtitle-observable premise — the real store applies subtitles by language', () => {
  it('setSubtitle(lang) writes subtitleLang — the exact state the ui Player consumes', () => {
    const store = usePlayerStore();
    store.setSubtitle('spa');
    expect(store.subtitleLang).toBe('spa');
    store.setSubtitle(null);
    expect(store.subtitleLang).toBeNull();
  });
});
