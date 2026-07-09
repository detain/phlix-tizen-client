/**
 * Music library store — artist, album, and track data with navigation state.
 *
 * Fetches from `GET /api/v1/music/artists`, `/api/v1/music/albums`,
 * `GET /api/v1/music/albums/{id}`, and `GET /api/v1/music/tracks/{id}`.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ApiClient } from '@phlix/ui';
import { useApiBase } from '@phlix/ui';
import type { MusicArtist, MusicAlbum, MusicTrack } from '@phlix/contracts';

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

  // ── UI state ──────────────────────────────────────────────────────────────
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentView = ref<MusicView>('artists');
  const selectedArtistId = ref<number | null>(null);
  const selectedAlbumId = ref<number | null>(null);

  // ── Computed ───────────────────────────────────────────────────────────────
  const artistAlbums = computed(() => {
    if (selectedArtistId.value === null) return [];
    return albums.value.filter((a) => a.artistId === selectedArtistId.value);
  });

  const albumTracks = computed(() => currentAlbum.value?.tracks ?? []);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function fetchArtists(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const client = getClient();
      const data = await client.get<{ artists: MusicArtist[] }>('/api/v1/music/artists');
      artists.value = data.artists ?? [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load artists';
      artists.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function fetchAlbums(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const client = getClient();
      const data = await client.get<{ albums: MusicAlbum[] }>('/api/v1/music/albums');
      albums.value = data.albums ?? [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load albums';
      albums.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function fetchAlbum(id: number): Promise<void> {
    loading.value = true;
    error.value = null;
    currentAlbum.value = null;
    try {
      const client = getClient();
      const data = await client.get<MusicAlbum>(`/api/v1/music/albums/${id}`);
      currentAlbum.value = data;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load album';
      currentAlbum.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTrack(id: number): Promise<void> {
    loading.value = true;
    error.value = null;
    currentTrack.value = null;
    try {
      const client = getClient();
      const data = await client.get<MusicTrack>(`/api/v1/music/tracks/${id}`);
      currentTrack.value = data;
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

  function selectArtist(id: number): void {
    selectedArtistId.value = id;
    selectedAlbumId.value = null;
    currentAlbum.value = null;
    currentView.value = 'albums';
  }

  function selectAlbum(id: number): void {
    selectedAlbumId.value = id;
    currentView.value = 'tracks';
    void fetchAlbum(id);
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
    // UI state
    loading,
    error,
    currentView,
    selectedArtistId,
    selectedAlbumId,
    // Computed
    artistAlbums,
    albumTracks,
    // Actions
    fetchArtists,
    fetchAlbums,
    fetchAlbum,
    fetchTrack,
    setView,
    selectArtist,
    selectAlbum,
    goBack,
    clearError,
  };
});