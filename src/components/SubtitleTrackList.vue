<script setup lang="ts">
/**
 * SubtitleTrackList — scrollable D-pad navigable list of subtitle tracks.
 *
 * Styled for a dark TV UI (nocturne theme). Each row shows the track language
 * (BCP 47 tag), codec, and flags (forced, default) as badges.
 *
 * Clicking/tapping a row calls `onSelect(track)` with the selected track.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { computed } from 'vue';
import type { StreamSubtitleTrack } from '@phlix/contracts';

interface Props {
  /** Ordered list of subtitle tracks from the media stream. */
  tracks: StreamSubtitleTrack[];
  /** The currently active/selected track id, if any. */
  activeTrackId?: string | null;
  /**
   * Called when the user selects a subtitle track.
   * Pass `null` to disable subtitles.
   * @param track The selected StreamSubtitleTrack, or null to turn off subtitles
   */
  onSelect: (track: StreamSubtitleTrack | null) => void;
}

const props = withDefaults(defineProps<Props>(), {
  activeTrackId: null,
});

/**
 * Format the language BCP 47 tag as a display name.
 * e.g. "en-US" → "English", "ja-JP" → "Japanese"
 */
function formatLanguage(tag: string): string {
  try {
    const base = tag.split('-')[0];
    const displayNames = new Intl.DisplayNames([base], { type: 'language' });
    const name = displayNames.of(base);
    if (name) return name;
  } catch {
    // Fall through to raw tag
  }
  return tag || 'Unknown';
}

/** Subtitle tracks are already ordered by the server; use them as-is. */
const sortedTracks = computed(() => props.tracks);

/** Total track count for aria labels. */
const totalCount = computed(() => props.tracks.length);
</script>

<template>
  <nav
    class="subtitle-track-list"
    aria-label="Subtitle track list"
  >
    <ul
      class="subtitle-track-list__items"
      role="listbox"
      :aria-label="`${totalCount} subtitle tracks`"
    >
      <!-- "Off" option to disable subtitles -->
      <li
        class="subtitle-track-list__item"
        :class="{ 'is-active': activeTrackId === null }"
        role="option"
        :aria-selected="activeTrackId === null"
        aria-label="No subtitles"
        tabindex="0"
        @click="onSelect(null)"
        @keydown.enter="onSelect(null)"
        @keydown.space.prevent="onSelect(null)"
      >
        <div class="subtitle-track-list__main">
          <span class="subtitle-track-list__language">Off</span>
        </div>
        <span
          v-if="activeTrackId === null"
          class="subtitle-track-list__active-indicator"
          aria-hidden="true"
        >▶</span>
      </li>

      <!-- Individual subtitle tracks -->
      <li
        v-for="track in sortedTracks"
        :key="track.id"
        class="subtitle-track-list__item"
        :class="{ 'is-active': track.id === activeTrackId }"
        role="option"
        :aria-selected="track.id === activeTrackId"
        :aria-label="[
          formatLanguage(track.language),
          track.title,
          track.codec,
          track.isForced ? 'forced' : null,
          track.isDefault ? 'default' : null,
        ].filter(Boolean).join(', ')"
        tabindex="0"
        @click="onSelect(track)"
        @keydown.enter="onSelect(track)"
        @keydown.space.prevent="onSelect(track)"
      >
        <div class="subtitle-track-list__main">
          <div class="subtitle-track-list__label-row">
            <span class="subtitle-track-list__language">
              {{ formatLanguage(track.language) }}
            </span>
            <div
              v-if="track.isForced || track.isDefault"
              class="subtitle-track-list__badges"
            >
              <span
                v-if="track.isForced"
                class="subtitle-track-list__badge subtitle-track-list__badge--forced"
              >Forced</span>
              <span
                v-if="track.isDefault"
                class="subtitle-track-list__badge subtitle-track-list__badge--default"
              >Default</span>
            </div>
          </div>
          <span
            v-if="track.title"
            class="subtitle-track-list__title"
          >{{ track.title }}</span>
        </div>
        <div class="subtitle-track-list__meta">
          <span class="subtitle-track-list__codec">{{ track.codec }}</span>
        </div>
        <span
          v-if="track.id === activeTrackId"
          class="subtitle-track-list__active-indicator"
          aria-hidden="true"
        >▶</span>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.subtitle-track-list {
  width: 100%;
}

.subtitle-track-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
  max-height: 40vh;
  overflow-y: auto;
  scroll-behavior: smooth;
}

/* Custom scrollbar for webkit browsers (Samsung Tizen supports this) */
.subtitle-track-list__items::-webkit-scrollbar {
  width: 6px;
}
.subtitle-track-list__items::-webkit-scrollbar-track {
  background: var(--surface-2, #1f1f23);
  border-radius: 3px;
}
.subtitle-track-list__items::-webkit-scrollbar-thumb {
  background: var(--border-strong, #3f3f46);
  border-radius: 3px;
}
.subtitle-track-list__items::-webkit-scrollbar-thumb:hover {
  background: var(--text-subtle, #71717a);
}

.subtitle-track-list__item {
  display: flex;
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
  outline: none;
}

.subtitle-track-list__item:hover {
  background: var(--surface-3, #27272a);
  border-color: var(--border-subtle, #3f3f46);
}

.subtitle-track-list__item:focus-visible,
.subtitle-track-list__item:focus-visible:focus-visible {
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
  border-color: var(--accent, #f59e0b);
}

.subtitle-track-list__item:active {
  transform: scale(0.98);
}

.subtitle-track-list__item.is-active {
  background: var(--surface-3, #27272a);
  border-color: var(--accent, #f59e0b);
}

.subtitle-track-list__main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.subtitle-track-list__label-row {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  flex-wrap: wrap;
}

.subtitle-track-list__language {
  font-size: var(--text-base, 1rem);
  font-weight: 600;
  color: var(--text, #e4e4e7);
}

.subtitle-track-list__title {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-subtle, #71717a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.subtitle-track-list__badges {
  display: flex;
  gap: var(--space-1, 0.25rem);
}

.subtitle-track-list__badge {
  font-size: var(--text-xs, 0.75rem);
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--radius-sm, 0.25rem);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.subtitle-track-list__badge--forced {
  background: var(--surface-3, #27272a);
  color: var(--text-muted, #a1a1aa);
  border: 1px solid var(--border-subtle, #3f3f46);
}

.subtitle-track-list__badge--default {
  background: var(--accent, #f59e0b);
  color: #000;
}

.subtitle-track-list__meta {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  flex-shrink: 0;
}

.subtitle-track-list__codec {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-muted, #a1a1aa);
  padding: 2px 6px;
  background: var(--surface-3, #27272a);
  border-radius: var(--radius-sm, 0.25rem);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.subtitle-track-list__active-indicator {
  color: var(--accent, #f59e0b);
  font-size: var(--text-sm, 0.875rem);
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .subtitle-track-list__item {
    transition: none;
  }
  .subtitle-track-list__item:active {
    transform: none;
  }
}
</style>
