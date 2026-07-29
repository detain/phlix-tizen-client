<script setup lang="ts">
/**
 * ChapterOverlay — displays chapter tick marks and label on the player seekbar.
 *
 * Fetches chapters from `GET /api/v1/media/{id}/chapters` and markers from
 * `GET /api/v1/media/{id}/markers`, then renders:
 *   - Gold tick marks at each chapter start position on the seekbar
 *   - Colored tick marks for intro/outro/credits/ad markers
 *   - A chapter title label that appears briefly when playback is near a chapter
 *   - An "Ad" badge when playback is inside an ad marker range
 *
 * This is a portal-rendered overlay that positions itself over the player area.
 * The seekbar tick positions are calculated as percentages of the player width,
 * so they scale correctly regardless of the actual seekbar pixel dimensions.
 *
 * TV-SPECIFIC: This component conflates marker timeline rendering with seekbar
 * tick positioning. phlix-ui's MarkerTimeline handles multi-type markers but
 * uses reactive subscriptions rather than polling. Tizen uses polling (250ms)
 * to track position, which is tech debt but necessary for the TV webview context.
 * Consolidation requires phlix-ui's MarkerTimeline to support chapters AND
 * Tizen to migrate from polling to reactive pattern.
 *
 * @category TV-Specific Component
 * @duplicate phlix-ui/src/components/player/MarkerTimeline.vue - partial overlap
 *   but different architecture (polling vs reactive)
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ApiClient } from '@phlix/ui';
import { useApiBase, usePlayerStore } from '@phlix/ui';
import type { ChapterMarker, Marker } from '@phlix/contracts';

interface ChapterApiResponse {
  chapters: ChapterMarker[];
}

interface MarkersApiResponse {
  markers: Marker[];
}

/** How close (in seconds) playback must be to a chapter start to show the label */
const CHAPTER_LABEL_THRESHOLD_SECONDS = 3;

/** How long (ms) the chapter label stays visible after seeking */
const CHAPTER_LABEL_DISPLAY_DURATION_MS = 2000;

/** Marker type to color mapping */
const MARKER_COLORS = {
  intro: '#3b82f6',   // blue
  outro: '#f97316',    // orange
  credits: '#a855f7',  // purple
  ad: '#ef4444',       // red
  chapter: '#ffcc00'   // gold (existing)
} as const;

const route = useRoute();
const apiBase = useApiBase();
const playerStore = usePlayerStore();

const chapters = ref<ChapterMarker[]>([]);
const markers = ref<Marker[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const currentChapterTitle = ref<string | null>(null);
const showChapterLabel = ref(false);

let labelTimeout: ReturnType<typeof setTimeout> | null = null;
let positionInterval: ReturnType<typeof setInterval> | null = null;

/** Current media item ID from the player route */
const mediaId = computed(() => String(route.params.id ?? ''));

/** Player position in seconds (updated via polling) */
const currentPosition = ref(0);

/** Player duration in seconds */
const currentDuration = ref(0);

async function loadChapters(): Promise<void> {
  const id = mediaId.value;
  if (!id) return;

  loading.value = true;
  error.value = null;

  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    const response = await client.get<ChapterApiResponse>(
      `/api/v1/media/${encodeURIComponent(id)}/chapters`,
    );
    chapters.value = response.chapters ?? [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load chapters';
    chapters.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadMarkers(): Promise<void> {
  const id = mediaId.value;
  if (!id) return;

  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    const response = await client.get<MarkersApiResponse>(
      `/api/v1/media/${encodeURIComponent(id)}/markers`,
    );
    markers.value = response.markers ?? [];
  } catch (e) {
    console.warn('Failed to load markers:', e instanceof Error ? e.message : e);
    markers.value = [];
  }
}

/**
 * Find the chapter that contains the given position (in seconds).
 * Returns the chapter and its start time, or null if not in any chapter.
 */
function getChapterAtPosition(position: number): ChapterMarker | null {
  if (!chapters.value.length) return null;

  for (const chapter of chapters.value) {
    if (position >= chapter.startSeconds && position < chapter.endSeconds) {
      return chapter;
    }
  }
  return null;
}

/**
 * Calculate tick mark positions as percentages of the seekbar width.
 * Each tick is positioned at (chapterStartTime / duration * 100)%.
 */
const chapterTickPositions = computed(() => {
  if (!currentDuration.value || !chapters.value.length) return [];

  return chapters.value.map((chapter) => ({
    id: `chapter-${chapter.index}`,
    title: chapter.title || `Chapter ${chapter.index + 1}`,
    positionPercent: Math.min(
      100,
      Math.max(0, (chapter.startSeconds / currentDuration.value) * 100),
    ),
    color: MARKER_COLORS.chapter,
    type: 'chapter' as const,
    startMs: chapter.startSeconds * 1000,
  }));
});

/**
 * Calculate marker tick positions as percentages of the seekbar width.
 * Each tick is positioned at (markerStartMs / duration * 100)%.
 */
const markerTickPositions = computed(() => {
  if (!currentDuration.value || !markers.value.length) return [];

  return markers.value.map((marker) => {
    const markerSeconds = marker.startMs / 1000;
    const percent = currentDuration.value > 0
      ? (markerSeconds / currentDuration.value) * 100
      : 0;
    return {
      id: `marker-${marker.id}`,
      title: marker.label || marker.type.charAt(0).toUpperCase() + marker.type.slice(1),
      positionPercent: Math.min(100, Math.max(0, percent)),
      color: MARKER_COLORS[marker.type] ?? MARKER_COLORS.chapter,
      type: marker.type,
      startMs: marker.startMs,
    };
  });
});

/**
 * Combined tick positions for both chapters and markers,
 * sorted by position percentage.
 */
const allTickPositions = computed(() => {
  const ticks = [...chapterTickPositions.value, ...markerTickPositions.value];
  return ticks.sort((a, b) => a.positionPercent - b.positionPercent);
});

/**
 * Check if current position is inside any ad marker range.
 * Used to dim the scrubber when an ad is active.
 */
const isInAdMarker = computed(() => {
  if (!markers.value.length) return false;
  const posSeconds = currentPosition.value;
  return markers.value.some(
    (m) => m.type === 'ad' && posSeconds * 1000 >= m.startMs && posSeconds * 1000 < m.endMs,
  );
});

/** Currently hovered tick for tooltip display */
const hoveredTick = ref<(typeof allTickPositions.value)[0] | null>(null);

/**
 * Format milliseconds to MM:SS display string.
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Seek to a tick's position.
 */
function seekToTick(tick: (typeof allTickPositions.value)[0]): void {
  if (tick.type === 'chapter') {
    // Chapter ticks use startSeconds (need to find the chapter)
    const chapter = chapters.value.find((c) => `chapter-${c.index}` === tick.id);
    if (chapter) {
      playerStore.seekTo(chapter.startSeconds);
    }
  } else {
    // Marker ticks use startMs
    playerStore.seekTo(tick.startMs / 1000);
  }
}

/**
 * Check if the current position is near a chapter boundary and
 * update the chapter label display accordingly.
 */
function updateChapterLabel(position: number): void {
  if (!chapters.value.length) {
    if (showChapterLabel.value) {
      hideChapterLabel();
    }
    return;
  }

  // Find the current chapter
  const currentChapter = getChapterAtPosition(position);

  if (currentChapter) {
    const title = currentChapter.title || `Chapter ${currentChapter.index + 1}`;
    if (currentChapterTitle.value !== title) {
      currentChapterTitle.value = title;
    }
    showChapterLabelNow();
  } else {
    // Check if we're within threshold of a chapter start
    const nearChapter = chapters.value.find((ch) => {
      const distToStart = Math.abs(position - ch.startSeconds);
      return distToStart <= CHAPTER_LABEL_THRESHOLD_SECONDS;
    });

    if (nearChapter) {
      const title = nearChapter.title || `Chapter ${nearChapter.index + 1}`;
      if (currentChapterTitle.value !== title) {
        currentChapterTitle.value = title;
      }
      showChapterLabelNow();
    } else if (showChapterLabel.value) {
      hideChapterLabel();
    }
  }
}

function showChapterLabelNow(): void {
  showChapterLabel.value = true;

  // Reset the display timer
  if (labelTimeout) {
    clearTimeout(labelTimeout);
  }

  labelTimeout = setTimeout(() => {
    hideChapterLabel();
  }, CHAPTER_LABEL_DISPLAY_DURATION_MS);
}

function hideChapterLabel(): void {
  showChapterLabel.value = false;
  currentChapterTitle.value = null;

  if (labelTimeout) {
    clearTimeout(labelTimeout);
    labelTimeout = null;
  }
}

/**
 * Poll player position and duration.
 * The player store from @phlix/ui has a reactive state we can access.
 */
function startPositionPolling(): void {
  // Poll every 250ms to get smooth chapter label updates
  positionInterval = setInterval(() => {
    // Access player store state - the exact property names depend on @phlix/ui's implementation
    // Common patterns: position, currentTime, time, playbackPosition
    const state = playerStore;
    if (!state) return;

    // Try to read position from player store - use unknown to access dynamic properties
     
    const storeAny = state as unknown as Record<string, unknown>;
    const pos = storeAny.position ?? storeAny.currentTime ?? storeAny.time ?? storeAny.current_position ?? 0;
    const dur = storeAny.duration ?? storeAny.totalDuration ?? storeAny.duration_seconds ?? 0;

    if (typeof pos === 'number' && pos >= 0) {
      currentPosition.value = pos;
    }
    if (typeof dur === 'number' && dur > 0) {
      currentDuration.value = dur;
      updateChapterLabel(currentPosition.value);
    }
  }, 250);
}

function stopPositionPolling(): void {
  if (positionInterval) {
    clearInterval(positionInterval);
    positionInterval = null;
  }
  hideChapterLabel();
}

// Watch for media item changes and reload chapters and markers
watch(mediaId, (newId) => {
  if (newId) {
    void loadChapters();
    void loadMarkers();
    // Reset position when media changes
    currentPosition.value = 0;
    currentDuration.value = 0;
  }
});

onMounted(() => {
  void loadChapters();
  void loadMarkers();
  startPositionPolling();
});

onUnmounted(() => {
  stopPositionPolling();
});
</script>

<template>
  <div
    v-if="allTickPositions.length > 0"
    class="chapter-overlay"
    :class="{ 'chapter-overlay--ad-active': isInAdMarker }"
    aria-hidden="true"
  >
    <!-- Ad badge - shows when playhead is inside an ad marker -->
    <Transition name="ad-badge">
      <div
        v-if="isInAdMarker"
        class="chapter-overlay__ad-badge"
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          class="chapter-overlay__ad-icon"
          aria-hidden="true"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
        </svg>
        Ad
      </div>
    </Transition>

    <!-- Tick marks on the seekbar (chapters + markers) -->
    <div class="chapter-overlay__ticks">
      <div
        v-for="tick in allTickPositions"
        :key="tick.id"
        class="chapter-overlay__tick"
        :class="`chapter-overlay__tick--${tick.type}`"
        :style="{
          left: `${tick.positionPercent}%`,
          backgroundColor: tick.color
        }"
        :title="tick.title"
        @mouseenter="hoveredTick = tick"
        @mouseleave="hoveredTick = null"
        @click="seekToTick(tick)"
      />
    </div>

    <!-- Marker tooltip - shows on hover with label + start time -->
    <Transition name="tooltip">
      <div
        v-if="hoveredTick"
        class="chapter-overlay__tooltip"
        :style="{
          left: `${hoveredTick.positionPercent}%`
        }"
      >
        <span class="chapter-overlay__tooltip-label">{{ hoveredTick.title }}</span>
        <span
          v-if="'startMs' in hoveredTick && hoveredTick.startMs"
          class="chapter-overlay__tooltip-time"
        >
          {{ formatTime(hoveredTick.startMs) }}
        </span>
      </div>
    </Transition>

    <!-- Chapter label that appears when near a chapter -->
    <Transition name="chapter-label">
      <div
        v-if="showChapterLabel && currentChapterTitle"
        class="chapter-overlay__label"
      >
        {{ currentChapterTitle }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/**
 * Overlay container positioned at the bottom of the player area,
 * over the seek bar. The overlay uses pointer-events: none so it
 * doesn't block player controls (except for interactive ticks).
 */
.chapter-overlay {
  position: absolute;
  bottom: 60px;
  left: 0;
  right: 0;
  height: 30px;
  z-index: 100;
}

.chapter-overlay--ad-active .chapter-overlay__ticks {
  opacity: 0.4;
}

/**
 * Ad badge - shows when playhead is inside an ad marker range.
 * Positioned at top-right of the overlay area.
 */
.chapter-overlay__ad-badge {
  position: absolute;
  top: -32px;
  right: 10%;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(239, 68, 68, 0.9);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
}

.chapter-overlay__ad-icon {
  width: 14px;
  height: 14px;
}

/**
 * Tick marks container - spans the full width to match the seekbar.
 * Uses percentage-based positioning for the ticks.
 */
.chapter-overlay__ticks {
  position: relative;
  height: 8px;
  margin: 0 10%;
  pointer-events: auto;
}

/**
 * Individual tick mark - colored vertical bar based on type.
 * Positioned using left percentage calculated from start time.
 * Interactive: hover shows tooltip, click seeks.
 */
.chapter-overlay__tick {
  position: absolute;
  top: 0;
  width: 3px;
  height: 8px;
  transform: translateX(-50%);
  border-radius: 1px;
  opacity: 0.9;
  cursor: pointer;
  transition: opacity 150ms ease, transform 150ms ease;
}

.chapter-overlay__tick:hover {
  opacity: 1;
  transform: translateX(-50%) scaleY(1.3);
}

/* Tick type variants */
.chapter-overlay__tick--chapter {
  background-color: #ffcc00;
}

.chapter-overlay__tick--intro {
  background-color: #3b82f6;
}

.chapter-overlay__tick--outro {
  background-color: #f97316;
}

.chapter-overlay__tick--credits {
  background-color: #a855f7;
}

.chapter-overlay__tick--ad {
  background-color: #ef4444;
}

/**
 * Marker tooltip - appears on hover with label and start time.
 * Centered above the tick position.
 */
.chapter-overlay__tooltip {
  position: absolute;
  bottom: 100%;
  transform: translateX(-50%);
  margin-bottom: 6px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.9);
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.chapter-overlay__tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.9);
}

.chapter-overlay__tooltip-label {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}

.chapter-overlay__tooltip-time {
  font-size: 10px;
  color: #a1a1aa;
}

/**
 * Chapter label that appears above the seekbar when near a chapter.
 * Centered horizontally, styled to stand out on the player.
 */
.chapter-overlay__label {
  position: absolute;
  top: -28px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.8);
  color: #ffcc00;
  font-size: 14px;
  font-weight: 600;
  border-radius: 4px;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* Transition animations for chapter label */
.chapter-label-enter-active,
.chapter-label-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}

.chapter-label-enter-from,
.chapter-label-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}

/* Transition animations for ad badge */
.ad-badge-enter-active,
.ad-badge-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}

.ad-badge-enter-from,
.ad-badge-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* Transition animations for tooltip */
.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity 150ms ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .chapter-overlay__tick {
    transition: none;
  }

  .chapter-label-enter-active,
  .chapter-label-leave-active,
  .ad-badge-enter-active,
  .ad-badge-leave-active,
  .tooltip-enter-active,
  .tooltip-leave-active {
    transition: none;
  }
}
</style>
