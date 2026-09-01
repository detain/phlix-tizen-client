<script lang="ts">
import { ApiClient } from '@phlix/ui';
import type { AudioTrack, SubtitleTrack } from '@phlix/contracts';

/**
 * S407: the shared playback-info tracks loader. The wire tuple
 * `GET /api/v1/media/{id}/playback-info` keeps EXACTLY ONE client-side URL
 * literal (the route gate's per-file census pins `AudioTracksPage.vue: 1`) —
 * every consumer of the rails imports THIS function instead of minting its
 * own literal (S407's subtitle consumer does; the gate's pins stay untouched).
 * The server always emits both rails (`MediaItemController::getPlaybackInfo`,
 * `StreamTrackShaper`-shaped). The response passes through VERBATIM —
 * consumers type the playback.ts WIRE pair, no hand-map (S404 ruling: the old
 * `Stream*` DB-mirror hand-map silently discarded wire keys).
 */
export interface PlaybackInfoTracksResponse {
  audio_tracks?: AudioTrack[];
  subtitle_tracks?: SubtitleTrack[];
}

export async function fetchPlaybackInfoTracks(
  baseUrl: string,
  itemId: string,
): Promise<PlaybackInfoTracksResponse> {
  const client = new ApiClient({ baseUrl });
  return client.get<PlaybackInfoTracksResponse>(
    `/api/v1/media/${encodeURIComponent(itemId)}/playback-info`,
  );
}

/**
 * S407 NAMED REFUSAL (audio tracks). The vendored `@phlix/ui#v0.99.0` player
 * store (dist/stores/usePlayerStore.d.ts) exposes NO audio-track surface: no
 * `audioTracks`/`currentAudioTrackId` state, no `setAudioTrack`/
 * `switchAudioTrack`/`setAudioTrackId` action, and no `hls` instance (only
 * `hlsMasterUrl`). The pre-S407 `onSelectTrack` duck-probed exactly those four
 * names and silently no-op'd on every miss (the S406 phantom-rail class). The
 * probes are replaced by this stated limit — `TrackApplyBoundary.test.ts`
 * asserts the real store surface, so if a genuine audio API lands, the
 * boundary test goes RED and this refusal must be retired with it.
 */
export const AUDIO_TRACK_APPLY_UNSUPPORTED_UI_STORE =
  'Audio track choice cannot be applied: the @phlix/ui player store exposes no audio-track switching surface (state: none; actions: setSubtitle/setQuality only).';
</script>

<script setup lang="ts">
/**
 * AudioTracksPage — displays the available audio tracks for a media item.
 *
 * Fetches from `GET /api/v1/media/{id}/playback-info` (`audio_tracks`, shaped
 * by the server's StreamTrackShaper) via the shared S407 loader. S280 finding:
 * this page previously called `GET /api/v1/media/{id}/audio-tracks`, a route
 * phlix-server never registered — the fallback silently threw on every
 * non-HLS item and the page rendered an empty list. `playback-info` is the
 * registered rail (`MediaItemController::getPlaybackInfo()`), and `@phlix/ui`'s
 * own player already reads its audio tracks from there.
 *
 * S407: selecting a row is a NAMED REFUSAL (`AUDIO_TRACK_APPLY_UNSUPPORTED_UI_STORE`),
 * not a silent no-op — the vendored store has no audio surface. The viewer
 * stays on the page and sees the reason.
 *
 * Route: /app/audio-tracks/:id  (registered via buildExtraRoutes in main.ts)
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApiBase } from '@phlix/ui';
// NOTE: `AudioTrack` type + `ApiClient` + the shared loader live in the plain
// <script> block above — both blocks compile into ONE module scope, so they
// are deliberately NOT re-imported here.
import AudioTrackList from '../components/AudioTrackList.vue';

const route = useRoute();
const router = useRouter();
const apiBase = useApiBase();

const audioTracks = ref<AudioTrack[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
/** S407: the visible named refusal, set when the viewer picks a row. */
const refusal = ref<string | null>(null);

const mediaId = computed(() => String(route.params.id ?? ''));

/**
 * S407 honest active-row state: null — the vendored store carries no
 * current-audio-track, so no row may claim to be active (a duck-probe of
 * absent fields pretended otherwise).
 */
const activeTrackId = computed<string | null>(() => null);

async function loadAudioTracks(): Promise<void> {
  const id = mediaId.value;
  if (!id) {
    error.value = 'No media id provided';
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;
  refusal.value = null;

  try {
    // S407: single honest path. The old `storeAny.audioTracks` probe tested a
    // field the vendored store does not have — it missed on every call and the
    // fetch below was the only live rail, so the fiction is gone and the wire
    // fetch is simply THE source.
    const response = await fetchPlaybackInfoTracks(apiBase.value, id);
    audioTracks.value = response.audio_tracks ?? [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load audio tracks';
    audioTracks.value = [];
  } finally {
    loading.value = false;
  }
}

/**
 * S407 named refusal replaces the 4-way duck-probe (setAudioTrack /
 * switchAudioTrack / setAudioTrackId / hls.audioTrack — none exist on the
 * vendored store; every branch silently missed and the page `router.back()`d
 * as if something applied). The viewer sees the exact boundary instead and
 * keeps the list open.
 */
function onSelectTrack(_track: AudioTrack): void {
  refusal.value = AUDIO_TRACK_APPLY_UNSUPPORTED_UI_STORE;
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
      <p
        v-if="refusal"
        class="audio-tracks-page__refusal"
        role="alert"
      >
        {{ refusal }}
      </p>
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

.audio-tracks-page__refusal {
  margin: 0 0 var(--space-4, 1rem);
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  border: 1px solid var(--accent, #f59e0b);
  border-radius: var(--radius-md, 0.375rem);
  background: var(--surface-2, #1f1f23);
  color: var(--accent, #f59e0b);
  font-size: var(--text-sm, 0.875rem);
}

@media (prefers-reduced-motion: reduce) {
  .audio-tracks-page__back,
  .audio-tracks-page__retry {
    transition: none;
  }
}
</style>
