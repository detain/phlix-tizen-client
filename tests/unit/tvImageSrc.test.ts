/**
 * tvImageSrc.test — M-TIZEN-39 (W-min170), the <img> scheme allow-list.
 *
 * The pure law first (every branch of safeTvImageSrc), then the shipped-
 * source pins: the four local components that bind SERVER-WIRE art URLs must
 * route every :src through the guard and send referrerpolicy="no-referrer".
 * Source greps (not component mounts) pin the sites — the components are
 * presentational and the guard is pure string logic; a mount harness adds
 * nothing the source pin does not already prove, and the estate's
 * ScreenSaverOverlay.test source-grep idiom is the precedent.
 *
 * NOTE: src/pages/MusicPage.vue is an ORPHAN at this pin (not routed by
 * main.ts — the live music surface ships inside the sealed ui bundle; same
 * family as the unconsumed RatingModal/SubtitleTrackList components). It is
 * guarded anyway: source honesty — if it is ever wired, it must not be the
 * one door left open.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { safeTvImageSrc } from '@/utils/tvImageSrc';

const REPO = path.resolve(__dirname, '..', '..');

const HTTPS_LAN = 'https://tv.example:8096';
const HTTP_LAN = 'http://192.168.1.20:8096';

describe('safeTvImageSrc — the binding-boundary scheme law', () => {
  it('nullish/blank in, empty out (the caller’s v-else placeholder shows)', () => {
    expect(safeTvImageSrc(undefined, HTTPS_LAN)).toBe('');
    expect(safeTvImageSrc(null, HTTPS_LAN)).toBe('');
    expect(safeTvImageSrc('', HTTPS_LAN)).toBe('');
    expect(safeTvImageSrc('   ', HTTPS_LAN)).toBe('');
  });

  it('https art passes verbatim — the CDN case', () => {
    const url = 'https://image.tmdb.org/t/p/w500/abc.jpg';
    expect(safeTvImageSrc(url, HTTPS_LAN)).toBe(url);
    expect(safeTvImageSrc(url, '')).toBe(url);
  });

  it('root-relative art is resolved by the ui resolver against the media base', () => {
    expect(safeTvImageSrc('/api/v1/artwork/1', HTTP_LAN)).toBe(`${HTTP_LAN}/api/v1/artwork/1`);
    // No base in effect (bare mounts / same-origin era): the path passes
    // through byte-ident — the resolver's documented no-base behavior.
    expect(safeTvImageSrc('/api/v1/artwork/1', '')).toBe('/api/v1/artwork/1');
  });

  it('plain http art is allowed ONLY from the paired server itself', () => {
    expect(safeTvImageSrc(`${HTTP_LAN}/api/v1/artwork/1`, HTTP_LAN)).toBe(`${HTTP_LAN}/api/v1/artwork/1`);
    // Foreign http = downgrade + referrer leak: refused, placeholder instead.
    expect(safeTvImageSrc('http://evil.example/art.png', HTTP_LAN)).toBe('');
    // No base at all: http is not the same-origin story — refused.
    expect(safeTvImageSrc('http://192.168.1.20:8096/art.png', '')).toBe('');
    // Port is part of the origin: same host, foreign port — refused.
    expect(safeTvImageSrc('http://192.168.1.20:9999/art.png', HTTP_LAN)).toBe('');
    // https art is never downgraded by an http base:
    expect(safeTvImageSrc('https://image.tmdb.org/x.jpg', HTTP_LAN)).toBe('https://image.tmdb.org/x.jpg');
  });

  it('every other scheme and shape fails closed', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:image/svg+xml;base64,AAAA',
      'blob:http://x/y',
      'file:///etc/passwd',
      'ftp://host/x.png',
      '//cdn.example/x.png', // protocol-relative — inherits the file:// widget origin
      'art/relative.png', // non-root-relative garbage
    ]) {
      expect(safeTvImageSrc(url, HTTP_LAN), url).toBe('');
    }
  });

  it('scheme spellings are case-folded by the URL parser (no bypass via caps)', () => {
    expect(safeTvImageSrc('HTTPS://CAPS.example/x.png', HTTP_LAN)).toBe('HTTPS://CAPS.example/x.png');
    expect(safeTvImageSrc('JAVASCRIPT:alert(1)', HTTP_LAN)).toBe('');
  });

  it('uppercase HTTP same-origin passes through the origin equality (scheme-normalized compare)', () => {
    expect(safeTvImageSrc('HTTP://192.168.1.20:8096/art.png', HTTP_LAN)).toBe('HTTP://192.168.1.20:8096/art.png');
  });
});

describe('safeTvImageSrc — shipped-source pins (all four wire-art binding sites)', () => {
  const SITES = [
    path.join('src', 'components', 'RecommendationCard.vue'),
    path.join('src', 'components', 'MusicAlbumCard.vue'),
    path.join('src', 'components', 'MusicArtistCard.vue'),
    path.join('src', 'pages', 'MusicPage.vue'),
  ] as const;

  for (const site of SITES) {
    const source = readFileSync(path.join(REPO, site), 'utf8');

    it(`${site}: :src is the guarded computed, never the raw wire field`, () => {
      expect(source).toContain("from '../utils/tvImageSrc'");
      expect(source).toContain('safeTvImageSrc(');
      // No raw binding survives: every :src must bind a *Src computed.
      const srcBindings = [...source.matchAll(/:src="([^"]+)"/g)].map((m) => m[1]);
      expect(srcBindings.length).toBeGreaterThan(0);
      for (const binding of srcBindings) {
        expect(binding, `${site} binding ${binding}`).toMatch(/^(posterSrc|coverSrc|photoSrc|albumArtSrc)$/);
      }
    });

    it(`${site}: art fetches carry no referrer (TV webviews leak the file:// + session context otherwise)`, () => {
      const imgTags = [...source.matchAll(/<img\b[^>]*>/gs)].map((m) => m[0]);
      expect(imgTags.length).toBeGreaterThan(0);
      for (const tag of imgTags) {
        expect(tag).toContain('referrerpolicy="no-referrer"');
      }
    });
  }
});
