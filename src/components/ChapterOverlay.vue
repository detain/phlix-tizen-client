<script setup lang="ts">
/**
 * ChapterOverlay — displays chapter tick marks and label on the player seekbar.
 *
 * Fetches chapters from `GET /api/v1/media/{id}/chapters` and renders:
 *   - Gold tick marks at each chapter start position on the seekbar
 *   - A chapter title label that appears briefly when playback is near a chapter
 *
 * This is a portal-rendered overlay that positions itself over the player area.
 * The seekbar tick positions are calculated as percentages of the player width,
 * so they scale correctly regardless of the actual seekbar pixel dimensions.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ApiClient } from '@phlix/ui';
import { useApiBase, usePlayerStore } from '@phlix/ui';
import type { ChapterMarker } from '@phlix/contracts';

interface ChapterApiResponse {
  chapters: ChapterMarker[];
}

/** How close (in seconds) playback must be to a chapter start to show the label */
const CHAPTER_LABEL_THRESHOLD_SECONDS = 3;

/** How long (ms) the chapter label stays visible after seeking */
const CHAPTER_LABEL_DISPLAY_DURATION_MS = 2000;

const route = useRoute();
const apiBase = useApiBase();
const playerStore = usePlayerStore();

const chapters = ref<ChapterMarker[]>([]);
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
    id: chapter.index,
    title: chapter.title || `Chapter ${chapter.index + 1}`,
    positionPercent: Math.min(
      100,
      Math.max(0, (chapter.startSeconds / currentDuration.value) * 100),
    ),
  }));
});

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

// Watch for media item changes and reload chapters
watch(mediaId, (newId) => {
  if (newId) {
    void loadChapters();
    // Reset position when media changes
    currentPosition.value = 0;
    currentDuration.value = 0;
  }
});

onMounted(() => {
  void loadChapters();
  startPositionPolling();
});

onUnmounted(() => {
  stopPositionPolling();
});
</script>

<template>
  <div
    v-if="chapters.length > 0"
    class="chapter-overlay"
    aria-hidden="true"
  >
    <!-- Chapter tick marks on the seekbar -->
    <div class="chapter-overlay__ticks">
      <div
        v-for="tick in chapterTickPositions"
        :key="tick.id"
        class="chapter-overlay__tick"
        :style="{ left: `${tick.positionPercent}%` }"
        :title="tick.title"
      />
    </div>

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
 * doesn't block player controls.
 */
.chapter-overlay {
  position: absolute;
  bottom: 60px;
  left: 0;
  right: 0;
  height: 30px;
  pointer-events: none;
  z-index: 100;
}

/**
 * Tick marks container - spans the full width to match the seekbar.
 * Uses percentage-based positioning for the ticks.
 */
.chapter-overlay__ticks {
  position: relative;
  height: 8px;
  margin: 0 10%;
}

/**
 * Individual chapter tick mark - a small gold vertical bar.
 * Positioned using left percentage calculated from chapter start time.
 */
.chapter-overlay__tick {
  position: absolute;
  top: 0;
  width: 3px;
  height: 8px;
  background-color: #ffcc00;
  transform: translateX(-50%);
  border-radius: 1px;
  opacity: 0.9;
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
</style>
