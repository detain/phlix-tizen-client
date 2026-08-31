<script setup lang="ts">
/**
 * AudioTrackList — scrollable D-pad navigable list of audio tracks.
 *
 * Styled for a dark TV UI (nocturne theme). Each row shows the track language
 * (BCP 47 tag or "Unknown"), codec, channel count (e.g., "5.1", "Stereo"),
 * and optional track title (e.g., "Director's Commentary").
 *
 * Clicking/tapping a row calls `onSelect(track)` with the selected track.
 *
 * TV-SPECIFIC: No phlix-ui equivalent for standalone audio track list.
 * phlix-ui handles audio tracks within CaptionsMenu.vue's audio section.
 * This component provides D-pad optimized list navigation for TV remote.
 *
 * @category TV-Specific Component
 * @duplicate No phlix-ui equivalent - TV-specific D-pad optimized component
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { computed } from 'vue';
import type { AudioTrack } from '@phlix/contracts';

interface Props {
  /** Ordered list of playback-info audio tracks (server StreamTrackShaper wire shape). */
  tracks: AudioTrack[];
  /** The currently active/playing track id, if any. */
  activeTrackId?: string | null;
  /**
   * Called when the user selects an audio track.
   * @param track The selected wire AudioTrack
   */
  onSelect: (track: AudioTrack) => void;
}

const props = withDefaults(defineProps<Props>(), {
  activeTrackId: null,
});

/**
 * Format the channel count as a human-readable string.
 * e.g. 2 → "Stereo", 6 → "5.1", 8 → "7.1"
 */
function formatChannels(channels: number): string {
  if (channels === 1) return 'Mono';
  if (channels === 2) return 'Stereo';
  if (channels === 6) return '5.1';
  if (channels === 8) return '7.1';
  if (channels === 12) return '7.1.4'; // Atmos
  return channels.toString();
}

/**
 * Format the language BCP 47 tag as a display name.
 * e.g. "en-US" → "English (US)", "ja-JP" → "Japanese"
 */
function formatLanguage(tag: string): string {
  // Try to use the browser's Intl API for a nice display name
  try {
    const displayNames = new Intl.DisplayNames([tag], { type: 'language' });
    const name = displayNames.of(tag);
    if (name) {
      // If it's a full tag like "en-US", extract just the language part for readability
      const base = tag.split('-')[0];
      const baseName = new Intl.DisplayNames([base], { type: 'language' }).of(base);
      if (tag.includes('-') && baseName && name.toLowerCase().startsWith(baseName.toLowerCase())) {
        // "en-US" → "English" rather than "English (US)"
        return baseName;
      }
      return name;
    }
  } catch {
    // Fall through to raw tag
  }
  return tag || 'Unknown';
}

/** Audio tracks are already ordered by the server; use them as-is. */
const sortedTracks = computed(() => props.tracks);

/** Total track count for aria labels. */
const totalCount = computed(() => props.tracks.length);
</script>

<template>
  <nav
    class="audio-track-list"
    aria-label="Audio track list"
  >
    <ul
      class="audio-track-list__items"
      role="listbox"
      :aria-label="`${totalCount} audio tracks`"
    >
      <li
        v-for="track in sortedTracks"
        :key="track.id"
        class="audio-track-list__item"
        role="option"
        :aria-selected="track.id === activeTrackId"
        :aria-label="[
          formatLanguage(track.language),
          track.title,
          track.codec,
          formatChannels(track.channels),
        ].filter(Boolean).join(', ')"
        tabindex="0"
        @click="onSelect(track)"
        @keydown.enter="onSelect(track)"
        @keydown.space.prevent="onSelect(track)"
      >
        <div class="audio-track-list__main">
          <span class="audio-track-list__language">
            {{ formatLanguage(track.language) }}
          </span>
          <span
            v-if="track.title"
            class="audio-track-list__title"
          >{{ track.title }}</span>
        </div>
        <div class="audio-track-list__meta">
          <span class="audio-track-list__channels">
            {{ formatChannels(track.channels) }}
          </span>
          <span class="audio-track-list__codec">{{ track.codec }}</span>
          <span
            v-if="track.bitrate"
            class="audio-track-list__bitrate numeric"
          >{{ (track.bitrate / 1000).toFixed(0) }}kbps</span>
        </div>
        <span
          v-if="track.id === activeTrackId"
          class="audio-track-list__active-indicator"
          aria-hidden="true"
        >▶</span>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.audio-track-list {
  width: 100%;
}

.audio-track-list__items {
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
.audio-track-list__items::-webkit-scrollbar {
  width: 6px;
}
.audio-track-list__items::-webkit-scrollbar-track {
  background: var(--surface-2, #1f1f23);
  border-radius: 3px;
}
.audio-track-list__items::-webkit-scrollbar-thumb {
  background: var(--border-strong, #3f3f46);
  border-radius: 3px;
}
.audio-track-list__items::-webkit-scrollbar-thumb:hover {
  background: var(--text-subtle, #71717a);
}

.audio-track-list__item {
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

.audio-track-list__item:hover {
  background: var(--surface-3, #27272a);
  border-color: var(--border-subtle, #3f3f46);
}

.audio-track-list__item:focus-visible,
.audio-track-list__item:focus-visible:focus-visible {
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
  border-color: var(--accent, #f59e0b);
}

.audio-track-list__item:active {
  transform: scale(0.98);
}

.audio-track-list__item[aria-selected="true"] {
  background: var(--surface-3, #27272a);
  border-color: var(--accent, #f59e0b);
}

.audio-track-list__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.audio-track-list__language {
  font-size: var(--text-base, 1rem);
  font-weight: 600;
  color: var(--text, #e4e4e7);
}

.audio-track-list__title {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-subtle, #71717a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.audio-track-list__meta {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  flex-shrink: 0;
}

.audio-track-list__channels,
.audio-track-list__codec,
.audio-track-list__bitrate {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-muted, #a1a1aa);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.audio-track-list__codec {
  padding: 2px 6px;
  background: var(--surface-3, #27272a);
  border-radius: var(--radius-sm, 0.25rem);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.audio-track-list__active-indicator {
  color: var(--accent, #f59e0b);
  font-size: var(--text-sm, 0.875rem);
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .audio-track-list__item {
    transition: none;
  }
  .audio-track-list__item:active {
    transform: none;
  }
}
</style>
