/**
 * languageLadder (S511 / AD-18) — the pure track-language preference resolver.
 *
 * Pins the LADDER ORDER the step is named for: per-item memory wins, then the
 * account/server preference, and neither is applied unless the title actually
 * offers that language. The bottom group is the S511 AC2 guarantee — an absent
 * preference resolves to `null` ("change nothing"), which is exactly today's
 * behaviour, so wiring the ladder cannot alter playback for a user with no
 * stored choice.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */
import { describe, it, expect } from 'vitest';
import { resolvePreferredLanguage } from '@/tracks/languageLadder';

describe('languageLadder — AC1 ladder order (per-item → server → none)', () => {
  const langs = ['eng', 'spa', 'fra'];

  it('per-item memory wins over the account preference', () => {
    const r = resolvePreferredLanguage({
      perItem: 'spa',
      server: 'eng',
      availableLanguages: langs,
    });
    expect(r).toEqual({ language: 'spa', source: 'per-item' });
  });

  it('falls back to the server preference when there is no per-item memory', () => {
    const r = resolvePreferredLanguage({
      perItem: null,
      server: 'fra',
      availableLanguages: langs,
    });
    expect(r).toEqual({ language: 'fra', source: 'server' });
  });

  it('a per-item memory the title does NOT offer yields to a server match (per-item → server)', () => {
    // Viewer last chose German here; this title has no German track, but the
    // account prefers French which IS available → server arm adopts it.
    const r = resolvePreferredLanguage({
      perItem: 'deu',
      server: 'fra',
      availableLanguages: langs,
    });
    expect(r).toEqual({ language: 'fra', source: 'server' });
  });
});

describe('languageLadder — value passthrough + tolerant matching', () => {
  it('returns the item OWN wire string (so it matches track.language verbatim)', () => {
    const r = resolvePreferredLanguage({
      perItem: 'EN',
      server: null,
      availableLanguages: ['en-US', 'ja'],
    });
    // 'EN' normalises to 'en', which matches the base of nothing here...
    expect(r.source).toBe('none');
    const r2 = resolvePreferredLanguage({
      perItem: 'ja',
      server: null,
      availableLanguages: ['JA', 'en'],
    });
    // ...but a real match hands back the wire spelling ('JA'), not the query.
    expect(r2).toEqual({ language: 'JA', source: 'per-item' });
  });

  it('case/whitespace tolerant on the preference value', () => {
    const r = resolvePreferredLanguage({
      perItem: '  Spa  ',
      server: null,
      availableLanguages: ['eng', 'spa'],
    });
    expect(r).toEqual({ language: 'spa', source: 'per-item' });
  });

  it('first wire row wins when case-folded duplicates are present (verbatim passthrough)', () => {
    const r = resolvePreferredLanguage({
      perItem: 'eng',
      server: null,
      availableLanguages: ['eng', 'ENG'],
    });
    expect(r.language).toBe('eng');
  });

  it('does NOT fuzzy-match different base tags (en ≠ eng — conservative, matches the page exact-equality rule)', () => {
    const r = resolvePreferredLanguage({
      perItem: 'eng',
      server: null,
      availableLanguages: ['en-US', 'en-GB'],
    });
    expect(r).toEqual({ language: null, source: 'none' });
  });
});

describe('languageLadder — AC2 absent preference changes nothing', () => {
  it('no per-item and no server → null / none', () => {
    const r = resolvePreferredLanguage({
      perItem: null,
      server: null,
      availableLanguages: ['eng', 'spa'],
    });
    expect(r).toEqual({ language: null, source: 'none' });
  });

  it('empty-string / blank preferences behave as absent', () => {
    const r = resolvePreferredLanguage({
      perItem: '',
      server: '   ',
      availableLanguages: ['eng'],
    });
    expect(r).toEqual({ language: null, source: 'none' });
  });

  it('a named preference the title has no row for → null (the honest "absent")', () => {
    const r = resolvePreferredLanguage({
      perItem: 'deu',
      server: 'kor',
      availableLanguages: ['eng', 'spa'],
    });
    expect(r).toEqual({ language: null, source: 'none' });
  });

  it('an empty track list → null (never throws on nothing to match)', () => {
    const r = resolvePreferredLanguage({
      perItem: 'eng',
      server: 'eng',
      availableLanguages: [],
    });
    expect(r).toEqual({ language: null, source: 'none' });
  });

  it('tolerates null/undefined entries in the available list', () => {
    const r = resolvePreferredLanguage({
      perItem: null,
      server: 'spa',
      availableLanguages: [null, undefined, 'spa'],
    });
    expect(r).toEqual({ language: 'spa', source: 'server' });
  });
});
