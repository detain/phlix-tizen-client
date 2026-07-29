<script setup lang="ts">
/**
 * SkipIntroOverlay — shows "Skip Intro" / "Skip Outro" buttons driven by markers.
 *
 * Fetches markers from `GET /api/v1/media/{id}/markers` and displays skip buttons
 * when playback is within the intro or outro marker ranges. The user can click
 * "Skip Intro" or "Skip Outro" to seek past those sections.
 *
 * This is a portal-rendered overlay that positions itself over the player area.
 * Styled for a dark TV UI (nocturne theme) with D-pad navigation support.
 *
 * TV-SPECIFIC: This component uses polling (250ms) to track player position
 * for visibility, whereas phlix-ui's SkipControls uses reactive props. This is
 * tech debt but necessary for the TV webview context. Consolidation requires
 * migrating Tizen to phlix-ui's reactive pattern.
 *
 * @category TV-Specific Component
 * @duplicate phlix-ui/src/components/player/SkipControls.vue - phlix-ui uses
 *   reactive pattern, Tizen uses polling
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ApiClient } from '@phlix/ui';
import { useApiBase, usePlayerStore } from '@phlix/ui';
import type { Marker, SkipButtonSpec } from '@phlix/contracts';

interface MarkersApiResponse {
  markers: Marker[];
  introMarker?: Marker | null;
  outroMarker?: Marker | null;
  skipButtonSpec?: SkipButtonSpec;
}

const route = useRoute();
const apiBase = useApiBase();
const playerStore = usePlayerStore();

const introMarker = ref<Marker | null>(null);
const outroMarker = ref<Marker | null>(null);
const loading = ref(false);

let positionInterval: ReturnType<typeof setInterval> | null = null;

/** Current media item ID from the player route */
const mediaId = computed(() => String(route.params.id ?? ''));

/** Player position in seconds (updated via polling) */
const currentPosition = ref(0);

/** Player duration in seconds */
const currentDuration = ref(0);

/**
 * Check if playback is within the intro marker range.
 * We show the skip intro button from the start until the end of the intro.
 */
const showSkipIntro = computed(() => {
  if (!introMarker.value) return false;
  const posSeconds = currentPosition.value;
  return posSeconds >= 0 && posSeconds < introMarker.value.endMs / 1000;
});

/**
 * Check if playback is within the outro marker range.
 * We show the skip outro button from the start of the outro until the end.
 */
const showSkipOutro = computed(() => {
  if (!outroMarker.value) return false;
  const posSeconds = currentPosition.value;
  const outroStartSeconds = outroMarker.value.startMs / 1000;
  return posSeconds >= outroStartSeconds && posSeconds < outroMarker.value.endMs / 1000;
});

const hasMarkers = computed(() => introMarker.value !== null || outroMarker.value !== null);

async function loadMarkers(): Promise<void> {
  const id = mediaId.value;
  if (!id) return;

  loading.value = true;

  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    const response = await client.get<MarkersApiResponse>(
      `/api/v1/media/${encodeURIComponent(id)}/markers`,
    );
    introMarker.value = response.introMarker ?? null;
    outroMarker.value = response.outroMarker ?? null;
  } catch {
    introMarker.value = null;
    outroMarker.value = null;
  } finally {
    loading.value = false;
  }
}

/**
 * Seek past the intro marker.
 * Uses seekTo with the intro end time converted to seconds.
 */
function skipIntro(): void {
  if (introMarker.value) {
    const skipToSeconds = introMarker.value.endMs / 1000;
    playerStore.seekTo(skipToSeconds);
  }
}

/**
 * Seek past the outro marker.
 * Uses seekTo with the outro start time converted to seconds (jump to end).
 */
function skipOutro(): void {
  if (outroMarker.value) {
    const skipToSeconds = outroMarker.value.startMs / 1000;
    playerStore.seekTo(skipToSeconds);
  }
}

/**
 * Poll player position and duration.
 */
function startPositionPolling(): void {
  positionInterval = setInterval(() => {
    const state = playerStore;
    if (!state) return;

    const storeAny = state as unknown as Record<string, unknown>;
    const pos = storeAny.position ?? storeAny.currentTime ?? storeAny.time ?? storeAny.current_position ?? 0;
    const dur = storeAny.duration ?? storeAny.totalDuration ?? storeAny.duration_seconds ?? 0;

    if (typeof pos === 'number' && pos >= 0) {
      currentPosition.value = pos;
    }
    if (typeof dur === 'number' && dur > 0) {
      currentDuration.value = dur;
    }
  }, 250);
}

function stopPositionPolling(): void {
  if (positionInterval) {
    clearInterval(positionInterval);
    positionInterval = null;
  }
}

// Watch for media item changes and reload markers
watch(mediaId, (newId) => {
  if (newId) {
    void loadMarkers();
    currentPosition.value = 0;
    currentDuration.value = 0;
  }
});

onMounted(() => {
  void loadMarkers();
  startPositionPolling();
});

onUnmounted(() => {
  stopPositionPolling();
});
</script>

<template>
  <div
    v-if="hasMarkers && (showSkipIntro || showSkipOutro)"
    class="skip-intro-overlay"
    aria-label="Skip controls"
  >
    <button
      v-if="showSkipIntro"
      class="skip-intro-overlay__button skip-intro-overlay__button--intro"
      type="button"
      aria-label="Skip intro"
      @click="skipIntro"
      @keydown.enter="skipIntro"
      @keydown.space.prevent="skipIntro"
    >
      <span class="skip-intro-overlay__icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polygon points="5 4 15 12 5 20 5 4" />
          <line
            x1="19"
            y1="5"
            x2="19"
            y2="19"
          />
        </svg>
      </span>
      <span class="skip-intro-overlay__label">Skip Intro</span>
    </button>

    <button
      v-if="showSkipOutro"
      class="skip-intro-overlay__button skip-intro-overlay__button--outro"
      type="button"
      aria-label="Skip outro"
      @click="skipOutro"
      @keydown.enter="skipOutro"
      @keydown.space.prevent="skipOutro"
    >
      <span class="skip-intro-overlay__icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polygon points="5 4 15 12 5 20 5 4" />
          <line
            x1="19"
            y1="5"
            x2="19"
            y2="19"
          />
        </svg>
      </span>
      <span class="skip-intro-overlay__label">Skip Outro</span>
    </button>
  </div>
</template>

<style scoped>
.skip-intro-overlay {
  position: absolute;
  bottom: 80px;
  right: 20px;
  display: flex;
  gap: var(--space-3, 0.75rem);
  z-index: 150;
  pointer-events: auto;
}

.skip-intro-overlay__button {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  border: 2px solid transparent;
  border-radius: var(--radius-md, 0.375rem);
  background: rgba(0, 0, 0, 0.85);
  cursor: pointer;
  transition:
    background var(--dur-fast, 150ms) var(--ease-out, ease-out),
    border-color var(--dur-fast, 150ms) var(--ease-out, ease-out),
    transform var(--dur-fast, 150ms) var(--ease-spring, ease);
  outline: none;
}

.skip-intro-overlay__button--intro {
  border-color: var(--accent, #f59e0b);
  color: var(--accent, #f59e0b);
}

.skip-intro-overlay__button--outro {
  border-color: var(--text-muted, #a1a1aa);
  color: var(--text-muted, #a1a1aa);
}

.skip-intro-overlay__button:hover {
  background: rgba(245, 158, 11, 0.15);
}

.skip-intro-overlay__button--intro:hover {
  background: rgba(245, 158, 11, 0.2);
}

.skip-intro-overlay__button--outro:hover {
  background: rgba(161, 161, 170, 0.15);
}

.skip-intro-overlay__button:focus-visible {
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.skip-intro-overlay__button:active {
  transform: scale(0.97);
}

.skip-intro-overlay__icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.skip-intro-overlay__icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.skip-intro-overlay__label {
  font-size: var(--text-sm, 0.875rem);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .skip-intro-overlay__button {
    transition: none;
  }

  .skip-intro-overlay__button:active {
    transform: none;
  }
}
</style>
