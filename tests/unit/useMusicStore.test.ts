/**
 * useMusicStore — music library paging (S125).
 *
 * ⚠ These tests drive the REAL `@phlix/ui` `ApiClient` against a stubbed
 * `globalThis.fetch` and assert the FULL request URL including its query
 * string. That is deliberate:
 *
 *  - A stub keyed on `url.includes('/music/artists')` happily serves a request
 *    to a wrong path that merely CONTAINS that substring, and cannot detect a
 *    dropped `limit`/`offset` param at all. Every URL assertion here is an
 *    EXACT string equality against the whole URL.
 *  - Mocking `ApiClient.listArtists` itself would assert only that the store
 *    called a helper, not what went on the wire — the paging bug this file
 *    exists to pin lives precisely in the query string.
 *
 * The payloads are the REAL server shapes, transcribed from
 * `phlix-server/src/Server/Http/Controllers/MusicController.php`:
 *   `listArtists()` → `{artists, total, limit, offset}` with snake_case rows
 *                     (`image_url`, `album_count`, `track_count`) and NO `id`.
 *   `listAlbums()`  → `{albums, total, limit, offset, artist}` with rows keyed
 *                     `name` (not `title`) and `artist` as a NAME STRING.
 *
 * The expected page size is hard-coded to 100 rather than imported from
 * `MUSIC_PAGE_SIZE`, so a change to that constant FAILS these tests instead of
 * silently re-deriving the expectation.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMusicStore } from '@/stores/useMusicStore';

const API_BASE = 'https://tv.example';

vi.mock('@phlix/ui', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useApiBase: () => ({ value: API_BASE }) };
});

/** Every URL fetched, in order — the subject of the exact-match assertions. */
let requested: string[] = [];
/** Queue of payloads served, one per request, in order. */
let responses: unknown[] = [];

function serve(payload: unknown): void {
  responses.push(payload);
}

function jsonResponse(payload: unknown): unknown {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

/** A raw server artist row — snake_case, and deliberately WITHOUT an `id`. */
function serverArtist(n: number): Record<string, unknown> {
  return {
    name: `Artist ${n}`,
    image_url: n % 2 === 0 ? null : `https://img.example/${n}.jpg`,
    album_count: 3,
    track_count: 42,
    albums_truncated: false,
    albums: [`Album ${n}A`],
  };
}

/** A raw server album row — `name` (not `title`), `artist` is a NAME string. */
function serverAlbum(n: number, artist = `Artist ${n}`): Record<string, unknown> {
  return {
    name: `Album ${n}`,
    artist,
    year: 2000 + (n % 20),
    album_art_url: null,
    track_count: 10,
    tracks_truncated: false,
    tracks: [],
  };
}

function artistPage(offset: number, count: number, total: number): unknown {
  return {
    artists: Array.from({ length: count }, (_, i) => serverArtist(offset + i + 1)),
    total,
    limit: 100,
    offset,
  };
}

function albumPage(offset: number, count: number, total: number, artist: string | null = null): unknown {
  return {
    albums: Array.from({ length: count }, (_, i) => serverAlbum(offset + i + 1, artist ?? `Artist ${offset + i + 1}`)),
    total,
    limit: 100,
    offset,
    artist,
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  requested = [];
  responses = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      requested.push(String(url));
      const next = responses.shift();
      if (next === undefined) throw new Error(`unexpected request: ${String(url)}`);
      return jsonResponse(next);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMusicStore — artist paging (S125)', () => {
  it('sends limit AND offset on the first artist page (exact URL)', async () => {
    serve(artistPage(0, 100, 2197));
    const store = useMusicStore();

    await store.fetchArtists();

    expect(requested).toEqual([`${API_BASE}/api/v1/music/artists?limit=100&offset=0`]);
  });

  it('records the SERVER total, not the page length', async () => {
    serve(artistPage(0, 100, 2197));
    const store = useMusicStore();

    await store.fetchArtists();

    expect(store.artists).toHaveLength(100);
    expect(store.artistsTotal).toBe(2197);
    expect(store.hasMoreArtists).toBe(true);
  });

  it('advances offset past 100 and APPENDS the next page', async () => {
    serve(artistPage(0, 100, 2197));
    serve(artistPage(100, 100, 2197));
    const store = useMusicStore();

    await store.fetchArtists();
    await store.loadMoreArtists();

    expect(requested).toEqual([
      `${API_BASE}/api/v1/music/artists?limit=100&offset=0`,
      `${API_BASE}/api/v1/music/artists?limit=100&offset=100`,
    ]);
    expect(store.artists).toHaveLength(200);
    // Appended, not replaced: page 1's first row and page 2's first row co-exist.
    expect(store.artists[0].name).toBe('Artist 1');
    expect(store.artists[100].name).toBe('Artist 101');
  });

  it('reaches EVERY artist in a 2,197-artist library and then terminates', async () => {
    const TOTAL = 2197;
    for (let offset = 0; offset < TOTAL; offset += 100) {
      serve(artistPage(offset, Math.min(100, TOTAL - offset), TOTAL));
    }
    const store = useMusicStore();

    await store.fetchArtists();
    // Bounded walk: 2197/100 → 22 pages, so 30 attempts proves termination too.
    for (let i = 0; i < 30 && store.hasMoreArtists; i++) {
      await store.loadMoreArtists();
    }

    expect(store.artists).toHaveLength(TOTAL);
    expect(store.artistsTotal).toBe(TOTAL);
    expect(store.hasMoreArtists).toBe(false);
    // 22 pages: offsets 0,100,…,2100. The last page carries the 97 remainder.
    expect(requested).toHaveLength(22);
    expect(requested[21]).toBe(`${API_BASE}/api/v1/music/artists?limit=100&offset=2100`);
    // Every artist is distinct — no page was re-fetched or dropped.
    expect(new Set(store.artists.map((a) => a.name)).size).toBe(TOTAL);
  });

  it('issues NO further request once every artist is loaded', async () => {
    serve(artistPage(0, 12, 12));
    const store = useMusicStore();

    await store.fetchArtists();
    expect(store.hasMoreArtists).toBe(false);

    await store.loadMoreArtists();

    expect(requested).toHaveLength(1);
  });

  it('normalizes the snake_case server row (name IS the identity)', async () => {
    serve(artistPage(0, 1, 1));
    const store = useMusicStore();

    await store.fetchArtists();

    expect(store.artists[0]).toMatchObject({
      id: 'Artist 1',
      name: 'Artist 1',
      imageUrl: 'https://img.example/1.jpg',
      albumCount: 3,
      trackCount: 42,
    });
  });
});

describe('useMusicStore — album paging (S125)', () => {
  it('sends limit AND offset on the first album page (exact URL)', async () => {
    serve(albumPage(0, 100, 5091));
    const store = useMusicStore();

    await store.fetchAlbums();

    expect(requested).toEqual([`${API_BASE}/api/v1/music/albums?limit=100&offset=0`]);
    expect(store.albumsTotal).toBe(5091);
    expect(store.hasMoreAlbums).toBe(true);
  });

  it('advances offset past 100 and appends', async () => {
    serve(albumPage(0, 100, 5091));
    serve(albumPage(100, 100, 5091));
    const store = useMusicStore();

    await store.fetchAlbums();
    await store.loadMoreAlbums();

    expect(requested[1]).toBe(`${API_BASE}/api/v1/music/albums?limit=100&offset=100`);
    expect(store.albums).toHaveLength(200);
  });

  it('filters the artist drill-down SERVER-SIDE via ?artist=', async () => {
    serve(artistPage(0, 100, 2197));
    serve(albumPage(0, 3, 3, 'Artist 7'));
    const store = useMusicStore();

    await store.fetchArtists();
    // selectArtist kicks off the filtered fetch as a floating promise, so wait
    // for the RESULT to land rather than for the request to merely be issued.
    store.selectArtist('Artist 7');
    await vi.waitFor(() => expect(store.artistAlbums).toHaveLength(3));

    expect(requested[1]).toBe(
      `${API_BASE}/api/v1/music/albums?limit=100&offset=0&artist=Artist+7`,
    );
    expect(store.artistAlbums).toHaveLength(3);
    expect(store.albumsTotal).toBe(3);
  });

  it('preserves the ?artist= filter when paging further into a drill-down', async () => {
    serve(albumPage(0, 100, 142, 'Artist 7'));
    serve(albumPage(100, 42, 142, 'Artist 7'));
    const store = useMusicStore();

    await store.fetchAlbums('Artist 7');
    await store.loadMoreAlbums();

    expect(requested).toEqual([
      `${API_BASE}/api/v1/music/albums?limit=100&offset=0&artist=Artist+7`,
      `${API_BASE}/api/v1/music/albums?limit=100&offset=100&artist=Artist+7`,
    ]);
    expect(store.albums).toHaveLength(142);
    expect(store.hasMoreAlbums).toBe(false);
  });

  it('normalizes the album row (name → title, artist stays a string)', async () => {
    serve(albumPage(0, 1, 1, 'Artist 7'));
    const store = useMusicStore();

    await store.fetchAlbums('Artist 7');

    expect(store.albums[0]).toMatchObject({
      id: 'Album 1',
      title: 'Album 1',
      artist: 'Artist 7',
      totalTracks: 10,
    });
  });
});

describe('useMusicStore — navigation and errors', () => {
  it('has empty initial state', () => {
    const store = useMusicStore();
    expect(store.artists).toEqual([]);
    expect(store.albums).toEqual([]);
    expect(store.currentAlbum).toBeNull();
    expect(store.currentTrack).toBeNull();
    expect(store.artistsTotal).toBe(0);
    expect(store.albumsTotal).toBe(0);
    expect(store.currentView).toBe('artists');
    expect(store.selectedArtistId).toBeNull();
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('artistAlbums is empty until the server-filtered page for THAT artist lands', async () => {
    serve(albumPage(0, 5, 5, 'Artist 1'));
    const store = useMusicStore();

    await store.fetchAlbums('Artist 1');
    expect(store.artistAlbums).toEqual([]); // no artist selected yet

    store.selectedArtistId = 'Artist 1';
    expect(store.artistAlbums).toHaveLength(5);

    // A different artist selected while the old page is still loaded must NOT
    // show the previous artist's albums.
    store.selectedArtistId = 'Artist 99';
    expect(store.artistAlbums).toEqual([]);
  });

  it('fetchAlbum requests the album by TITLE, disambiguated by artist', async () => {
    serve({ album: serverAlbum(1, 'Artist 7') });
    const store = useMusicStore();

    await store.fetchAlbum('Album 1', 'Artist 7');

    expect(requested).toEqual([
      `${API_BASE}/api/v1/music/albums/Album%201?artist=Artist+7`,
    ]);
    expect(store.currentAlbum?.title).toBe('Album 1');
  });

  it('fetchTrack requests the track by its media-item id', async () => {
    serve({ track: { id: 'uuid-abc', name: 'Track 1', metadata: {} } });
    const store = useMusicStore();

    await store.fetchTrack('uuid-abc');

    expect(requested).toEqual([`${API_BASE}/api/v1/music/tracks/uuid-abc`]);
    expect(store.currentTrack?.id).toBe('uuid-abc');
  });

  it('surfaces a failed artist fetch and leaves the list empty', async () => {
    const store = useMusicStore();
    // No queued response → the stub throws.
    await store.fetchArtists();

    expect(store.artists).toEqual([]);
    expect(store.artistsTotal).toBe(0);
    expect(store.error).toBeTruthy();
    expect(store.loading).toBe(false);
  });

  it('a failed loadMore keeps the already-loaded page intact', async () => {
    serve(artistPage(0, 100, 2197));
    const store = useMusicStore();

    await store.fetchArtists();
    await store.loadMoreArtists(); // no queued response → fails

    expect(store.artists).toHaveLength(100);
    expect(store.error).toBeTruthy();
    expect(store.loadingMore).toBe(false);
  });

  it('goBack returns to the artists view and clears the selection', async () => {
    const store = useMusicStore();
    store.currentView = 'albums';
    store.selectedArtistId = 'Artist 7';

    store.goBack();

    expect(store.currentView).toBe('artists');
    expect(store.selectedArtistId).toBeNull();
  });

  it('setView switches the view', () => {
    const store = useMusicStore();
    store.setView('albums');
    expect(store.currentView).toBe('albums');
    store.setView('artists');
    expect(store.currentView).toBe('artists');
  });

  it('clearError resets the error', () => {
    const store = useMusicStore();
    store.error = 'boom';
    store.clearError();
    expect(store.error).toBeNull();
  });

  it('albumTracks reads the current album track list', async () => {
    serve({
      album: {
        name: 'Album 1',
        artist: 'Artist 7',
        track_count: 2,
        tracks: [
          { id: 'a', name: 'One', metadata: {} },
          { id: 'b', name: 'Two', metadata: {} },
        ],
      },
    });
    const store = useMusicStore();

    await store.fetchAlbum('Album 1');

    expect(store.albumTracks).toHaveLength(2);
  });
});
