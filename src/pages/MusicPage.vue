<script setup lang="ts">
/**
 * MusicPage — music library browser.
 *
 * Shows artist list by default. When an artist is selected, shows their albums.
 * When an album is selected, shows its track listing with play functionality.
 *
 * TV-SPECIFIC: This component is kept locally despite phlix-ui having
 * MusicLibraryPage.vue because:
 *   1. Tizen's BACK button behavior uses `router.back()` to exit to parent app
 *      when at the artists view, whereas phlix-ui stays within the music module.
 *      This TV-specific UX (exiting the app on BACK at root) is intentional.
 *   2. Uses useMusicStore for TV-optimized data fetching patterns
 *   3. Minor UI/layout differences may exist for TV viewing distance
 *
 * Both Tizen and phlix-ui use internal state machine patterns for view
 * switching (artists → albums → tracks), so architectural patterns are similar.
 *
 * Route: /app/music  (registered via buildExtraRoutes in main.ts)
 *
 * @category TV-Specific Component
 * @duplicate phlix-ui/src/pages/MusicLibraryPage.vue - but TV navigation
 *   behavior (router.back() exit) justifies separate implementation
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useMusicStore } from '../stores/useMusicStore';
import type { MusicTrack } from '../stores/useMusicStore';
import MusicArtistCard from '../components/MusicArtistCard.vue';
import MusicAlbumCard from '../components/MusicAlbumCard.vue';
import TrackListItem from '../components/TrackListItem.vue';

const router = useRouter();
const musicStore = useMusicStore();

const emit = defineEmits<{
  (e: 'play', track: MusicTrack): void;
}>();

function getPageTitle(): string {
  switch (musicStore.currentView) {
    case 'artists':
      return 'Artists';
    case 'albums':
      // The artist's identity IS its display name (the server has no artist PK).
      return musicStore.selectedArtistId ?? 'Albums';
    case 'tracks':
      return musicStore.currentAlbum?.title ?? 'Tracks';
    default:
      return 'Music';
  }
}

function onArtistSelect(id: string): void {
  musicStore.selectArtist(id);
}

function onAlbumSelect(id: string): void {
  musicStore.selectAlbum(id);
}

function onTrackPlay(id: string): void {
  // Fetch track data for playback — thin client delegates actual playback to @phlix/ui
  void musicStore.fetchTrack(id).then(() => {
    if (musicStore.currentTrack) {
      // Emit play event for parent app to handle music playback
      emit('play', musicStore.currentTrack);
    }
  });
}

function goBack(): void {
  if (musicStore.currentView === 'tracks') {
    musicStore.goBack();
  } else if (musicStore.currentView === 'albums') {
    musicStore.goBack();
  } else {
    void router.back();
  }
}

/**
 * Loads the artist list once.
 *
 * Albums are NOT pre-loaded: `selectArtist()` fetches them filtered to the
 * chosen artist SERVER-SIDE (`?artist=`), which is both correct (a client-side
 * filter over page 1 leaves most artists with an empty album list) and ~140×
 * cheaper than the unfiltered album query.
 */
function loadInitialData(): void {
  if (musicStore.currentView === 'artists' && musicStore.artists.length === 0) {
    void musicStore.fetchArtists();
  }
}

/**
 * Pulls the next page as the D-pad ARRIVES at the trailing "Load more" tile.
 *
 * On a TV there is no pointer and no scrollbar, so focus is the only signal
 * that the user has reached the end of the grid. Firing on `focusin` (rather
 * than on click alone) means simply continuing to press Down/Right past the
 * last card keeps the library flowing; the button still activates on
 * Enter/click for an explicit request, and the store no-ops re-entrant calls.
 */
function onLoadMoreFocus(): void {
  if (musicStore.currentView === 'artists') {
    void musicStore.loadMoreArtists();
  } else if (musicStore.currentView === 'albums') {
    void musicStore.loadMoreAlbums();
  }
}

onMounted(loadInitialData);
watch(() => musicStore.currentView, loadInitialData);
</script>

<template>
  <div class="music-page">
    <header class="music-page__header">
      <button
        class="music-page__back"
        type="button"
        aria-label="Go back"
        @click="goBack"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="music-page__title">
        {{ getPageTitle() }}
      </h1>
    </header>

    <!-- Loading state -->
    <div
      v-if="musicStore.loading"
      class="music-page__loading"
      role="status"
      aria-busy="true"
      aria-label="Loading music"
    >
      <p>Loading music…</p>
    </div>

    <!-- Error state -->
    <div
      v-else-if="musicStore.error"
      class="music-page__error"
      role="alert"
    >
      <p>{{ musicStore.error }}</p>
      <button
        type="button"
        class="music-page__retry"
        @click="musicStore.clearError(); loadInitialData()"
      >
        Retry
      </button>
    </div>

    <!-- Artists view -->
    <div
      v-else-if="musicStore.currentView === 'artists'"
      class="music-page__grid"
      role="list"
      :aria-label="`${musicStore.artistsTotal} artists`"
    >
      <MusicArtistCard
        v-for="artist in musicStore.artists"
        :key="artist.id"
        :artist="artist"
        role="listitem"
        @select="onArtistSelect"
      />
      <button
        v-if="musicStore.hasMoreArtists"
        type="button"
        class="music-page__load-more"
        role="listitem"
        :disabled="musicStore.loadingMore"
        :aria-label="`Load more artists — showing ${musicStore.artists.length} of ${musicStore.artistsTotal}`"
        @focusin="onLoadMoreFocus"
        @click="onLoadMoreFocus"
      >
        <span class="music-page__load-more-count">
          {{ musicStore.artists.length }} / {{ musicStore.artistsTotal }}
        </span>
        <span>{{ musicStore.loadingMore ? 'Loading…' : 'Load more' }}</span>
      </button>
    </div>

    <!-- Albums view -->
    <div
      v-else-if="musicStore.currentView === 'albums'"
      class="music-page__grid"
      role="list"
      :aria-label="`${musicStore.albumsTotal} albums`"
    >
      <MusicAlbumCard
        v-for="album in musicStore.artistAlbums"
        :key="album.id"
        :album="album"
        role="listitem"
        @select="onAlbumSelect"
      />
      <button
        v-if="musicStore.hasMoreAlbums"
        type="button"
        class="music-page__load-more"
        role="listitem"
        :disabled="musicStore.loadingMore"
        :aria-label="`Load more albums — showing ${musicStore.albums.length} of ${musicStore.albumsTotal}`"
        @focusin="onLoadMoreFocus"
        @click="onLoadMoreFocus"
      >
        <span class="music-page__load-more-count">
          {{ musicStore.albums.length }} / {{ musicStore.albumsTotal }}
        </span>
        <span>{{ musicStore.loadingMore ? 'Loading…' : 'Load more' }}</span>
      </button>
    </div>

    <!-- Tracks view -->
    <div
      v-else-if="musicStore.currentView === 'tracks' && musicStore.currentAlbum"
      class="music-page__tracks"
    >
      <div class="music-page__album-header">
        <img
          v-if="musicStore.currentAlbum.albumArtUrl"
          :src="musicStore.currentAlbum.albumArtUrl"
          :alt="`Album art for ${musicStore.currentAlbum.title}`"
          class="music-page__album-art"
        >
        <div
          v-else
          class="music-page__album-art music-page__album-art--placeholder"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
            />
            <circle
              cx="12"
              cy="12"
              r="3"
            />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </div>
        <div class="music-page__album-info">
          <h2 class="music-page__album-title">
            {{ musicStore.currentAlbum.title }}
          </h2>
          <p
            v-if="musicStore.currentAlbum.artist"
            class="music-page__album-artist"
          >
            {{ musicStore.currentAlbum.artist }}
          </p>
          <p
            v-if="musicStore.currentAlbum.year"
            class="music-page__album-year"
          >
            {{ musicStore.currentAlbum.year }} · {{ musicStore.currentAlbum.totalTracks }} tracks
          </p>
        </div>
      </div>

      <div
        class="music-page__track-list"
        role="list"
        :aria-label="`${musicStore.albumTracks.length} tracks`"
      >
        <TrackListItem
          v-for="track in musicStore.albumTracks"
          :key="track.id"
          :track="track"
          role="listitem"
          @play="onTrackPlay"
        />
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else
      class="music-page__empty"
    >
      <p>No music found.</p>
    </div>
  </div>
</template>

<style scoped>
.music-page {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-6, 1.5rem);
}

.music-page__header {
  display: flex;
  align-items: center;
  gap: var(--space-4, 1rem);
  margin-bottom: var(--space-8, 2rem);
  padding-bottom: var(--space-4, 1rem);
  border-bottom: 1px solid var(--border-subtle, #3f3f46);
}

.music-page__back {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: var(--radius-full, 9999px);
  background: var(--surface-2, #1f1f23);
  color: var(--text-muted, #a1a1aa);
  cursor: pointer;
  transition:
    background var(--dur-fast, 150ms) var(--ease-out, ease-out),
    color var(--dur-fast, 150ms) var(--ease-out, ease-out);
  flex-shrink: 0;
}

.music-page__back svg {
  width: 1.25rem;
  height: 1.25rem;
}

.music-page__back:hover {
  background: var(--surface-3, #27272a);
  color: var(--text, #e4e4e7);
}

.music-page__back:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.music-page__title {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: var(--text-3xl, 1.875rem);
  font-weight: 700;
  color: var(--text, #e4e4e7);
  margin: 0;
}

/* ── Loading / Error / Empty ── */
.music-page__loading,
.music-page__error,
.music-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4, 1rem);
  padding: var(--space-10, 2.5rem);
  text-align: center;
  color: var(--text-muted, #a1a1aa);
  min-height: 40vh;
}

.music-page__retry {
  padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
  border: 1px solid var(--border-strong, #52525b);
  border-radius: var(--radius-md, 0.375rem);
  background: var(--surface-2, #1f1f23);
  color: var(--text, #e4e4e7);
  font-size: var(--text-sm, 0.875rem);
  cursor: pointer;
  transition:
    background var(--dur-fast, 150ms) var(--ease-out, ease-out),
    border-color var(--dur-fast, 150ms) var(--ease-out, ease-out);
}

.music-page__retry:hover {
  background: var(--surface-3, #27272a);
  border-color: var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.music-page__retry:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

/* ── Grid ── */
.music-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-6, 1.5rem);
}

@media (max-width: 640px) {
  .music-page__grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--space-4, 1rem);
  }
}

/* ── Load more (D-pad reachable: a real focusable button, no hover affordance) ── */
.music-page__load-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2, 0.5rem);
  min-height: 180px;
  border: 2px dashed var(--border-strong, #52525b);
  border-radius: var(--radius-lg, 0.5rem);
  background: var(--surface-2, #1f1f23);
  color: var(--text, #e4e4e7);
  font-size: var(--text-lg, 1.125rem);
  cursor: pointer;
}

.music-page__load-more-count {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-muted, #a1a1aa);
}

.music-page__load-more:focus-visible,
.music-page__load-more:focus {
  outline: none;
  border-style: solid;
  border-color: var(--accent, #f59e0b);
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.music-page__load-more[disabled] {
  cursor: default;
  opacity: 0.7;
}

/* ── Album / Tracks view ── */
.music-page__tracks {
  display: flex;
  flex-direction: column;
  gap: var(--space-6, 1.5rem);
}

.music-page__album-header {
  display: flex;
  gap: var(--space-6, 1.5rem);
  align-items: center;
  padding: var(--space-4, 1rem);
  background: var(--surface-2, #1f1f23);
  border-radius: var(--radius-lg, 0.5rem);
}

.music-page__album-art {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: var(--radius-md, 0.375rem);
  flex-shrink: 0;
}

.music-page__album-art--placeholder {
  display: grid;
  place-items: center;
  background: var(--surface-3, #27272a);
  color: var(--text-muted, #a1a1aa);
}

.music-page__album-art--placeholder svg {
  width: 40%;
  height: 40%;
  opacity: 0.5;
}

.music-page__album-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
  min-width: 0;
}

.music-page__album-title {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: var(--text-2xl, 1.5rem);
  font-weight: 700;
  color: var(--text, #e4e4e7);
  margin: 0;
}

.music-page__album-artist {
  font-size: var(--text-lg, 1.125rem);
  color: var(--accent, #f59e0b);
  margin: 0;
}

.music-page__album-year {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-muted, #a1a1aa);
  margin: 0;
}

.music-page__track-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
}

@media (prefers-reduced-motion: reduce) {
  .music-page__back,
  .music-page__retry {
    transition: none;
  }
}
</style>
