/**
 * Music library store — artist, album, and track data with navigation state.
 *
 * Fetches from `GET /api/v1/music/artists`, `/api/v1/music/albums`,
 * `GET /api/v1/music/albums/{name}`, and `GET /api/v1/music/tracks/{id}`.
 *
 * ## Paging (S125)
 *
 * Every `/api/v1/music/*` LIST endpoint is paged and hard-capped server-side at
 * `PageLimit::MAX = 100` (`phlix-server/src/Common/Http/PageLimit.php:51`); an
 * over-large `?limit=` is silently CLAMPED, never rejected. The list responses
 * are flat (NOT a `{success, data}` envelope) and carry the paging metadata:
 *
 *   `GET /api/v1/music/artists` → `{ artists, total, limit, offset }`
 *   `GET /api/v1/music/albums`  → `{ albums,  total, limit, offset, artist }`
 *
 * This store previously called `client.get('/api/v1/music/artists')` with no
 * `limit`/`offset` and typed the reply as `{ artists: MusicArtist[] }` — an
 * annotation that dropped `total` on the floor. On the production library that
 * showed 100 of 2,197 artists with no way to reach the rest, and no hint the
 * rest existed. We now page through the whole library incrementally and keep
 * `artistsTotal`/`albumsTotal` so the UI can display the TRUE library size
 * rather than the size of page 1.
 *
 * ## Why the `@phlix/ui` `ApiClient` helpers rather than raw `client.get`
 *
 * `listArtists()` / `listAlbums()` / `getAlbum()` / `getTrack()` send the
 * `?limit=`/`?offset=`/`?artist=` params, read `total`, and — critically —
 * NORMALIZE the server's snake_case rows (`image_url`, `album_count`,
 * `track_count`, `album_art_url`, `name`) into the camelCase shapes the TV
 * components already render. The raw `client.get` path skipped that
 * normalization entirely, so it also returned objects that did not match the
 * `@phlix/contracts` types it claimed to return.
 *
 * ⚠ Artists and albums have NO client-visible numeric primary key. The server
 * keys both by DISPLAY NAME (`MusicController::getArtist`/`getAlbum` take the
 * name as the `{mbid}` route param), so `MusicArtist.id`/`MusicAlbum.id` are
 * the name/title STRING. Selection state is therefore keyed by string.
 *
 * ⚠ Album drill-down filters SERVER-SIDE via `?artist=`. `/albums` is ordered
 * globally by artist then title, so page 1's 100 rows span only ~23 of the
 * library's 2,197 artists — filtering a client-side page made most artists
 * drill down to an empty list.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ApiClient, MUSIC_PAGE_SIZE } from '@phlix/ui';
import { useApiBase } from '@phlix/ui';
import type { MusicArtistsResult, MusicAlbumsResult } from '@phlix/ui';

/**
 * The normalized music row shapes, derived from `@phlix/ui`'s PUBLIC result
 * types.
 *
 * `@phlix/ui` re-exports `MusicArtistsResult`/`MusicAlbumsResult` from its
 * package index but NOT the row interfaces themselves, so these are projected
 * out of the results rather than deep-imported from `@phlix/ui/dist/...`. They
 * therefore track the package's own contract automatically.
 *
 * ⚠ These are NOT the same shapes as `@phlix/contracts`' identically-named
 * `MusicArtist`/`MusicAlbum`/`MusicTrack`. The contracts versions declare a
 * numeric `id`/`artistId` and a `title`, none of which this server sends on the
 * music routes — which is exactly why the raw `client.get` path in this store
 * silently produced objects that did not match its own type annotation.
 */
export type MusicArtist = MusicArtistsResult['artists'][number];
export type MusicAlbum = MusicAlbumsResult['albums'][number];
export type MusicTrack = NonNullable<MusicAlbum['tracks']>[number];

export type MusicView = 'artists' | 'albums' | 'tracks';

export const useMusicStore = defineStore('phlix-music', () => {
  // ── API client ────────────────────────────────────────────────────────────
  const apiBase = useApiBase();
  const getClient = () => new ApiClient({ baseUrl: apiBase.value });

  // ── Data state ────────────────────────────────────────────────────────────
  const artists = ref<MusicArtist[]>([]);
  const albums = ref<MusicAlbum[]>([]);
  const currentAlbum = ref<MusicAlbum | null>(null);
  const currentTrack = ref<MusicTrack | null>(null);

  // ── Paging state ──────────────────────────────────────────────────────────
  /** TRUE library artist count from the server's `total` (NOT `artists.length`). */
  const artistsTotal = ref(0);
  /** TRUE album count for the current listing, honouring any `?artist=` filter. */
  const albumsTotal = ref(0);
  /** Artist name the loaded `albums` are filtered to server-side, or null. */
  const albumsArtistFilter = ref<string | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const loading = ref(false);
  /** True only while APPENDING a further page, so the grid is not torn down. */
  const loadingMore = ref(false);
  const error = ref<string | null>(null);
  const currentView = ref<MusicView>('artists');
  const selectedArtistId = ref<string | null>(null);
  const selectedAlbumId = ref<string | null>(null);

  // ── Computed ───────────────────────────────────────────────────────────────
  /** More artists exist on the server than are currently loaded. */
  const hasMoreArtists = computed(() => artists.value.length < artistsTotal.value);
  /** More albums exist for the current listing than are currently loaded. */
  const hasMoreAlbums = computed(() => albums.value.length < albumsTotal.value);

  /**
   * The selected artist's albums.
   *
   * Filtering is SERVER-SIDE (`?artist=`), so this is just the loaded page-set
   * once it belongs to the selected artist. Returning `[]` while the filter has
   * not caught up prevents a previous artist's albums flashing under a new one.
   */
  const artistAlbums = computed(() => {
    if (selectedArtistId.value === null) return [];
    if (albumsArtistFilter.value !== selectedArtistId.value) return [];
    return albums.value;
  });

  const albumTracks = computed(() => currentAlbum.value?.tracks ?? []);

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Loads the FIRST page of artists, replacing anything already loaded. */
  async function fetchArtists(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const page = await getClient().listArtists({ limit: MUSIC_PAGE_SIZE, offset: 0 });
      artists.value = page.artists;
      artistsTotal.value = page.total;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load artists';
      artists.value = [];
      artistsTotal.value = 0;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Appends the NEXT page of artists.
   *
   * `offset` is the number already loaded, so paging terminates naturally when
   * `artists.length` reaches the server's `total`. A no-op when nothing more
   * exists or a load is already in flight (a held D-pad key can re-enter this).
   */
  async function loadMoreArtists(): Promise<void> {
    if (!hasMoreArtists.value || loading.value || loadingMore.value) return;
    loadingMore.value = true;
    error.value = null;
    try {
      const page = await getClient().listArtists({
        limit: MUSIC_PAGE_SIZE,
        offset: artists.value.length,
      });
      artists.value = [...artists.value, ...page.artists];
      artistsTotal.value = page.total;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load more artists';
    } finally {
      loadingMore.value = false;
    }
  }

  /**
   * Loads the FIRST page of albums, optionally filtered to one artist
   * server-side. Passing `artist` is what makes the drill-down correct.
   */
  async function fetchAlbums(artist?: string | null): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const page = await getClient().listAlbums({
        limit: MUSIC_PAGE_SIZE,
        offset: 0,
        ...(artist ? { artist } : {}),
      });
      albums.value = page.albums;
      albumsTotal.value = page.total;
      albumsArtistFilter.value = artist ?? null;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load albums';
      albums.value = [];
      albumsTotal.value = 0;
      albumsArtistFilter.value = artist ?? null;
    } finally {
      loading.value = false;
    }
  }

  /** Appends the NEXT page of albums, preserving the active `?artist=` filter. */
  async function loadMoreAlbums(): Promise<void> {
    if (!hasMoreAlbums.value || loading.value || loadingMore.value) return;
    loadingMore.value = true;
    error.value = null;
    try {
      const filter = albumsArtistFilter.value;
      const page = await getClient().listAlbums({
        limit: MUSIC_PAGE_SIZE,
        offset: albums.value.length,
        ...(filter ? { artist: filter } : {}),
      });
      albums.value = [...albums.value, ...page.albums];
      albumsTotal.value = page.total;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load more albums';
    } finally {
      loadingMore.value = false;
    }
  }

  /**
   * Loads one album's detail (with its FULL track list — the detail route is
   * exempt from the list route's per-album track cap).
   *
   * @param title  The album title; albums have no client-visible PK.
   * @param artist Disambiguates a shared title. 2,622 of production's 5,091
   *   album titles are shared by more than one artist, while zero titles repeat
   *   WITHIN an artist — so passing this makes the lookup exact.
   */
  async function fetchAlbum(title: string, artist?: string | null): Promise<void> {
    loading.value = true;
    error.value = null;
    currentAlbum.value = null;
    try {
      currentAlbum.value = await getClient().getAlbum(title, artist ?? undefined);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load album';
      currentAlbum.value = null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Loads one track by its media-item UUID. Unlike the raw items embedded in an
   * album, this carries a server-minted signed `streamUrl`.
   */
  async function fetchTrack(id: string): Promise<void> {
    loading.value = true;
    error.value = null;
    currentTrack.value = null;
    try {
      currentTrack.value = await getClient().getTrack(id);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load track';
      currentTrack.value = null;
    } finally {
      loading.value = false;
    }
  }

  function setView(view: MusicView): void {
    currentView.value = view;
  }

  /**
   * Drills into one artist. `id` is the artist NAME (its server-side identity).
   * Re-fetches the album list filtered to that artist SERVER-SIDE.
   */
  function selectArtist(id: string): void {
    selectedArtistId.value = id;
    selectedAlbumId.value = null;
    currentAlbum.value = null;
    currentView.value = 'albums';
    void fetchAlbums(id);
  }

  /** Drills into one album. `id` is the album TITLE (its server-side identity). */
  function selectAlbum(id: string): void {
    selectedAlbumId.value = id;
    currentView.value = 'tracks';
    void fetchAlbum(id, selectedArtistId.value);
  }

  function goBack(): void {
    if (currentView.value === 'tracks' && selectedArtistId.value !== null) {
      currentView.value = 'albums';
      currentAlbum.value = null;
      selectedAlbumId.value = null;
    } else if (currentView.value === 'albums') {
      currentView.value = 'artists';
      selectedArtistId.value = null;
      // artistAlbums is computed — will auto-return [] when selectedArtistId is null
    }
  }

  function clearError(): void {
    error.value = null;
  }

  return {
    // Data
    artists,
    albums,
    currentAlbum,
    currentTrack,
    // Paging
    artistsTotal,
    albumsTotal,
    albumsArtistFilter,
    hasMoreArtists,
    hasMoreAlbums,
    // UI state
    loading,
    loadingMore,
    error,
    currentView,
    selectedArtistId,
    selectedAlbumId,
    // Computed
    artistAlbums,
    albumTracks,
    // Actions
    fetchArtists,
    loadMoreArtists,
    fetchAlbums,
    loadMoreAlbums,
    fetchAlbum,
    fetchTrack,
    setView,
    selectArtist,
    selectAlbum,
    goBack,
    clearError,
  };
});
