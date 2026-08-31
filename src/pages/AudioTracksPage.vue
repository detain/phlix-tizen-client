<script setup lang="ts">
/**
 * AudioTracksPage — displays the available audio tracks for a media item.
 *
 * Fetches audio tracks from the HLS manifest (via player store) or from
 * `GET /api/v1/media/{id}/playback-info` (`audio_tracks`, shaped by the
 * server's StreamTrackShaper). S280 finding: this page previously called
 * `GET /api/v1/media/{id}/audio-tracks`, a route phlix-server never
 * registered — the fallback silently threw on every non-HLS item and the
 * page rendered an empty list. `playback-info` is the registered rail
 * (`MediaItemController::getPlaybackInfo()`), and `@phlix/ui`'s own player
 * already reads its audio tracks from there.
 *
 * Each track row allows switching the active audio track during playback.
 *
 * Route: /app/audio-tracks/:id  (registered via buildExtraRoutes in main.ts)
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiClient } from '@phlix/ui';
import { useApiBase, usePlayerStore } from '@phlix/ui';
import type { AudioTrack } from '@phlix/contracts';
import AudioTrackList from '../components/AudioTrackList.vue';

/**
 * `playback-info` response — only the slice this page reads. `audio_tracks[]`
 * IS the contracts `AudioTrack` wire shape verbatim (server
 * `StreamTrackShaper::audioTracks()`: `id, index, stream_index, codec,
 * language, channels, bitrate (always present, nullable), title (nullable),
 * default`), so the rows pass through untouched — S404: the previous hand-map
 * into the `StreamAudioTrack` DB mirror silently discarded
 * `index`/`stream_index`/`default`, a mapping the wire type makes
 * unnecessary.
 */
interface PlaybackInfoApiResponse {
  audio_tracks?: AudioTrack[];
}

const route = useRoute();
const router = useRouter();
const apiBase = useApiBase();
const playerStore = usePlayerStore();

const audioTracks = ref<AudioTrack[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const mediaId = computed(() => String(route.params.id ?? ''));

/** Current active audio track ID from player store */
const activeTrackId = computed(() => {
  const storeAny = playerStore as unknown as Record<string, unknown>;
  return (storeAny.audioTrackId ?? storeAny.activeAudioTrack ?? null) as string | null;
});

async function loadAudioTracks(): Promise<void> {
  const id = mediaId.value;
  if (!id) {
    error.value = 'No media id provided';
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    // First try to get tracks from the player store (HLS manifest)
    const storeAny = playerStore as unknown as Record<string, unknown>;
    const playerTracks = storeAny.audioTracks as AudioTrack[] | undefined;

    if (playerTracks && playerTracks.length > 0) {
      audioTracks.value = playerTracks;
    } else {
      // Fall back to the registered playback-info rail (S280: the previous
      // `/media/{id}/audio-tracks` route was never registered server-side).
      const client = new ApiClient({ baseUrl: apiBase.value });
      const response = await client.get<PlaybackInfoApiResponse>(
        `/api/v1/media/${encodeURIComponent(id)}/playback-info`,
      );
      audioTracks.value = response.audio_tracks ?? [];
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load audio tracks';
    audioTracks.value = [];
  } finally {
    loading.value = false;
  }
}

/**
 * Switch to the selected audio track.
 * Uses the player store's audio track switching method if available,
 * falling back to direct HLS audio track API.
 */
function onSelectTrack(track: AudioTrack): void {
  const storeAny = playerStore as unknown as Record<string, unknown>;

  // Try player store method first
  if (typeof storeAny.setAudioTrack === 'function') {
    storeAny.setAudioTrack(track.id);
  } else if (typeof storeAny.switchAudioTrack === 'function') {
    storeAny.switchAudioTrack(track.id);
  } else if (typeof storeAny.setAudioTrackId === 'function') {
    storeAny.setAudioTrackId(track.id);
  } else {
    // Fall back to direct HLS audio track setting via stored hls instance
    const hls = storeAny.hls as { audioTrack: number } | undefined;
    if (hls && typeof hls.audioTrack === 'number') {
      // Find the track index by id
      const trackIndex = audioTracks.value.findIndex(t => t.id === track.id);
      if (trackIndex >= 0) {
        hls.audioTrack = trackIndex;
      }
    }
  }

  // Navigate back after selection
  void router.back();
}

function goBack(): void {
  void router.back();
}

onMounted(loadAudioTracks);
watch(mediaId, loadAudioTracks);
</script>

<template>
  <div class="audio-tracks-page">
    <header class="audio-tracks-page__header">
      <button
        class="audio-tracks-page__back"
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
      <h1 class="audio-tracks-page__title">
        <template v-if="loading">
          Audio Tracks…
        </template>
        <template v-else-if="audioTracks.length">
          {{ audioTracks.length }} {{ audioTracks.length === 1 ? 'Audio Track' : 'Audio Tracks' }}
        </template>
        <template v-else>
          Audio Tracks
        </template>
      </h1>
    </header>

    <div
      v-if="loading"
      class="audio-tracks-page__loading"
      role="status"
      aria-busy="true"
      aria-label="Loading audio tracks"
    >
      <p>Loading audio tracks…</p>
    </div>

    <div
      v-else-if="error"
      class="audio-tracks-page__error"
      role="alert"
    >
      <p>{{ error }}</p>
      <button
        type="button"
        class="audio-tracks-page__retry"
        @click="loadAudioTracks"
      >
        Retry
      </button>
    </div>

    <div
      v-else-if="audioTracks.length === 0"
      class="audio-tracks-page__empty"
    >
      <p>No alternative audio tracks available for this media.</p>
    </div>

    <template v-else>
      <AudioTrackList
        :tracks="audioTracks"
        :active-track-id="activeTrackId"
        :on-select="onSelectTrack"
      />
    </template>
  </div>
</template>

<style scoped>
.audio-tracks-page {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: var(--space-6, 1.5rem);
}

.audio-tracks-page__header {
  display: flex;
  align-items: center;
  gap: var(--space-4, 1rem);
  margin-bottom: var(--space-6, 1.5rem);
  padding-bottom: var(--space-4, 1rem);
  border-bottom: 1px solid var(--border-subtle, #3f3f46);
}

.audio-tracks-page__back {
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

.audio-tracks-page__back svg {
  width: 1.25rem;
  height: 1.25rem;
}

.audio-tracks-page__back:hover {
  background: var(--surface-3, #27272a);
  color: var(--text, #e4e4e7);
}

.audio-tracks-page__back:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.audio-tracks-page__title {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: var(--text-2xl, 1.5rem);
  font-weight: 700;
  color: var(--text, #e4e4e7);
  margin: 0;
}

.audio-tracks-page__loading,
.audio-tracks-page__error,
.audio-tracks-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4, 1rem);
  padding: var(--space-10, 2.5rem);
  text-align: center;
  color: var(--text-muted, #a1a1aa);
}

.audio-tracks-page__retry {
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

.audio-tracks-page__retry:hover {
  background: var(--surface-3, #27272a);
  border-color: var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.audio-tracks-page__retry:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

@media (prefers-reduced-motion: reduce) {
  .audio-tracks-page__back,
  .audio-tracks-page__retry {
    transition: none;
  }
}
</style>
