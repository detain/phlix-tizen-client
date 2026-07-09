<script setup lang="ts">
/**
 * ChapterList — scrollable D-pad navigable list of chapter markers.
 *
 * Styled for a dark TV UI (nocturne theme). Each row shows the chapter index,
 * title (or "Chapter N" fallback), and start time formatted as mm:ss or hh:mm:ss.
 * Clicking/tapping a row calls `onSeek(startMs)` with the chapter's start time
 * in milliseconds — matching the signature used by the player store's seekTo().
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { computed } from 'vue';
import type { ChapterMarker } from '@phlix/contracts';

interface Props {
  /** Ordered list of chapter markers for one media item (from GET /api/v1/media/{id}/chapters). */
  chapters: ChapterMarker[];
  /**
   * Called when the user selects a chapter.
   * @param startMs Chapter start time in **milliseconds** (start_seconds * 1000).
   */
  onSeek: (startMs: number) => void;
}

const props = defineProps<Props>();

/**
 * Format `startSeconds` (float, e.g. 90.5) as h:mm:ss or m:ss.
 * Times >= 1 hour render as "h:mm:ss"; shorter times render as "m:ss".
 */
function formatTime(startSeconds: number): string {
  const totalSec = Math.floor(startSeconds);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Display label for a chapter: the title if present and non-null, else "Chapter N". */
function chapterLabel(chapter: ChapterMarker, listIndex: number): string {
  if (chapter.title?.trim()) {
    return chapter.title.trim();
  }
  return `Chapter ${listIndex + 1}`;
}

/** Chapters are already ordered by the server; use them as-is. */
const sortedChapters = computed(() => props.chapters);

/** Total chapter count for aria labels. */
const totalCount = computed(() => props.chapters.length);
</script>

<template>
  <nav
    class="chapter-list"
    aria-label="Chapter list"
  >
    <ul
      class="chapter-list__items"
      role="listbox"
      :aria-label="`${totalCount} chapters`"
    >
      <li
        v-for="(chapter, listIndex) in sortedChapters"
        :key="listIndex"
        class="chapter-list__item"
        role="option"
        :aria-selected="false"
        :aria-label="`${chapterLabel(chapter, listIndex)}, ${formatTime(chapter.start_seconds)}`"
        tabindex="0"
        @click="onSeek(chapter.start_seconds * 1000)"
        @keydown.enter="onSeek(chapter.start_seconds * 1000)"
        @keydown.space.prevent="onSeek(chapter.start_seconds * 1000)"
      >
        <span class="chapter-list__index">{{ listIndex + 1 }}</span>
        <span class="chapter-list__title">{{ chapterLabel(chapter, listIndex) }}</span>
        <span class="chapter-list__time numeric">{{ formatTime(chapter.start_seconds) }}</span>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.chapter-list {
  width: 100%;
}

.chapter-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
  max-height: 60vh;
  overflow-y: auto;
  /* Smooth scroll for D-pad navigation */
  scroll-behavior: smooth;
}

/* Custom scrollbar for webkit browsers (Samsung Tizen supports this) */
.chapter-list__items::-webkit-scrollbar {
  width: 6px;
}
.chapter-list__items::-webkit-scrollbar-track {
  background: var(--surface-2, #1f1f23);
  border-radius: 3px;
}
.chapter-list__items::-webkit-scrollbar-thumb {
  background: var(--border-strong, #3f3f46);
  border-radius: 3px;
}
.chapter-list__items::-webkit-scrollbar-thumb:hover {
  background: var(--text-subtle, #71717a);
}

.chapter-list__item {
  display: grid;
  grid-template-columns: 2.5rem 1fr auto;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  border-radius: var(--radius-md, 0.375rem);
  background: var(--surface-2, #1f1f23);
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    background var(--dur-fast, 150ms) var(--ease-out, ease-out),
    border-color var(--dur-fast, 150ms) var(--ease-out, ease-out),
    transform var(--dur-fast, 150ms) var(--ease-spring, ease);
  /* Spatial-nav focus ring */
  outline: none;
}

.chapter-list__item:hover {
  background: var(--surface-3, #27272a);
  border-color: var(--border-subtle, #3f3f46);
}

.chapter-list__item:focus-visible,
.chapter-list__item:focus-visible:focus-visible {
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
  border-color: var(--accent, #f59e0b);
}

.chapter-list__item:active {
  transform: scale(0.98);
}

.chapter-list__index {
  font-size: var(--text-sm, 0.875rem);
  font-weight: 600;
  color: var(--text-muted, #a1a1aa);
  text-align: center;
  min-width: 2rem;
}

.chapter-list__title {
  font-size: var(--text-base, 1rem);
  font-weight: 500;
  color: var(--text, #e4e4e7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chapter-list__time {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-subtle, #71717a);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .chapter-list__item {
    transition: none;
  }
  .chapter-list__item:active {
    transform: none;
  }
}
</style>
