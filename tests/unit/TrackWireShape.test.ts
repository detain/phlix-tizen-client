/**
 * TrackWireShape — S404 golden-vector gate on the tizen side.
 *
 * The rows below are VERBATIM captures of phlix-server's
 * `StreamTrackShaper` emission at `01340633` — the same golden vectors
 * `@phlix/contracts` pins in its `test/fixtures/stream-track-vectors.json`
 * (embedded text with a bitmap ordinal gap, an external download row, and
 * the full audio pair). They are asserted against the key-list constants
 * exported by the INSTALLED `@phlix/contracts` package (the shipped dist,
 * via the v0.4.5 pin), so this test reddens if either the consumer pin or
 * the shipped contract shape drifts from the wire — the exact bug class S404
 * closed (contracts once demanded a `display_title` the server never emitted).
 */
import { describe, it, expect } from 'vitest';
import { AUDIO_TRACK_KEYS, SUBTITLE_TRACK_KEYS } from '@phlix/contracts';
import type { AudioTrack, SubtitleTrack } from '@phlix/contracts';

/** Golden audio rows (StreamTrackShaper::audioTracks() @ server 01340633). */
const GOLDEN_AUDIO: AudioTrack[] = [
  {
    id: 'as-1',
    index: 0,
    stream_index: 1,
    codec: 'eac3',
    language: 'en',
    channels: 6,
    bitrate: 640000,
    title: null,
    default: false,
  },
  {
    id: 'as-2',
    index: 1,
    stream_index: 2,
    codec: 'aac',
    language: 'en',
    channels: 2,
    bitrate: 128000,
    title: 'Commentary',
    default: true,
  },
];

/** Golden subtitle rows: embedded pair (PGS gap) + external download row. */
const GOLDEN_SUBTITLES: SubtitleTrack[] = [
  {
    id: 'ss-1',
    index: 0,
    stream_index: 1,
    language: 'eng',
    label: 'eng',
    codec: 'subrip',
    source: null,
    hearing_impaired: true,
    url: '/api/v1/media/11111111-2222-3333-4444-555555555555/subtitles/0',
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
    url: '/api/v1/media/11111111-2222-3333-4444-555555555555/subtitles/2',
  },
  {
    id: 'ss-ext',
    index: 1,
    stream_index: 1,
    language: 'und',
    label: 'Subtitle 1',
    codec: 'webvtt',
    source: 'opensubtitles',
    hearing_impaired: true,
    url: '/api/v1/media/11111111-2222-3333-4444-555555555555/subtitles/external/ss-ext',
  },
];

describe('TrackWireShape (S404 golden vectors)', () => {
  it('pins a non-empty corpus (never vacuous)', () => {
    expect(GOLDEN_AUDIO.length).toBeGreaterThan(0);
    expect(GOLDEN_SUBTITLES.length).toBeGreaterThan(0);
    expect(AUDIO_TRACK_KEYS.length).toBe(9);
    expect(SUBTITLE_TRACK_KEYS.length).toBe(9);
  });

  it('audio golden rows carry the shipped contract key set exactly, in order', () => {
    for (const t of GOLDEN_AUDIO) {
      expect(Object.keys(t)).toEqual([...AUDIO_TRACK_KEYS]);
    }
  });

  it('subtitle golden rows carry the shipped contract key set exactly, in order', () => {
    for (const t of GOLDEN_SUBTITLES) {
      expect(Object.keys(t)).toEqual([...SUBTITLE_TRACK_KEYS]);
    }
  });

  it('the shipped contract carries no display_title fiction on either kind', () => {
    expect([...AUDIO_TRACK_KEYS, ...SUBTITLE_TRACK_KEYS]).not.toContain('display_title');
    // The subtitle wire's display string is the server-derived label, and it
    // has no forced/default concept:
    expect(SUBTITLE_TRACK_KEYS).toContain('label');
    expect(SUBTITLE_TRACK_KEYS).not.toContain('title');
    expect(SUBTITLE_TRACK_KEYS).not.toContain('isForced');
    expect(SUBTITLE_TRACK_KEYS).not.toContain('isDefault');
  });

  it('subtitle rows only ever map emitted keys onto what SubtitleTrackList renders', () => {
    // The picker renders language/label/codec/hearing_impaired — every one of
    // those must be a declared wire key (this is the AC: no consumer reads a
    // non-emitted key).
    for (const rendered of ['language', 'label', 'codec', 'hearing_impaired']) {
      expect([...SUBTITLE_TRACK_KEYS]).toContain(rendered);
    }
    for (const rendered of ['language', 'title', 'codec', 'channels', 'bitrate']) {
      expect([...AUDIO_TRACK_KEYS]).toContain(rendered);
    }
  });
});
