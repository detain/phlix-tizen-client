/**
 * TrackListItem — displays a single music track with play button.
 *
 * Shows track number, title, and duration. Clicking play emits a play event.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import type { MusicTrack } from '@phlix/contracts';

interface Props {
  /** The track to display. */
  track: MusicTrack;
  /** Whether this track is currently playing. */
  isPlaying?: boolean;
}

withDefaults(defineProps<Props>(), {
  isPlaying: false,
});

const emit = defineEmits<{
  /** Fired when the user clicks the play button. */
  (e: 'play', id: number): void;
}>();

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
</script>

<template>
  <div
    class="track-list-item"
    role="button"
    tabindex="0"
    :aria-label="`${track.title} — ${formatDuration(track.durationSecs)}`"
    :class="{ 'track-list-item--playing': isPlaying }"
    @click="emit('play', track.id)"
    @keydown.enter="emit('play', track.id)"
    @keydown.space.prevent="emit('play', track.id)"
  >
    <span class="track-list-item__number">
      <span v-if="isPlaying" class="track-list-item__playing-indicator" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="4" width="4" height="16" rx="1" />
          <rect x="10" y="8" width="4" height="12" rx="1" />
          <rect x="16" y="6" width="4" height="14" rx="1" />
        </svg>
      </span>
      <span v-else>{{ track.trackNumber ?? '—' }}</span>
    </span>

    <div class="track-list-item__info">
      <span class="track-list-item__title">{{ track.title }}</span>
      <span v-if="track.artist" class="track-list-item__artist">{{ track.artist.name }}</span>
    </div>

    <span class="track-list-item__duration">{{ formatDuration(track.durationSecs) }}</span>

    <button
      class="track-list-item__play"
      type="button"
      :aria-label="`Play ${track.title}`"
      @click.stop="emit('play', track.id)"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M8 5v14l11-7z" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.track-list-item {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  background: transparent;
  border-radius: var(--radius-md, 0.375rem);
  cursor: pointer;
  transition:
    background var(--dur-fast, 150ms) var(--ease-out, ease-out);
  outline: none;
}

.track-list-item:hover {
  background: var(--surface-2, #1f1f23);
}

.track-list-item:focus-visible {
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.track-list-item--playing {
  background: var(--accent-dim, rgba(245, 158, 11, 0.1));
}

/* ── Track number ── */
.track-list-item__number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  min-width: 2rem;
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-muted, #a1a1aa);
  font-variant-numeric: tabular-nums;
}

.track-list-item__playing-indicator {
  display: flex;
  color: var(--accent, #f59e0b);
}

.track-list-item__playing-indicator svg {
  width: 1rem;
  height: 1rem;
}

/* ── Info ── */
.track-list-item__info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
  flex: 1;
  min-width: 0;
}

.track-list-item__title {
  font-size: var(--text-base, 1rem);
  font-weight: 500;
  color: var(--text, #e4e4e7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-list-item--playing .track-list-item__title {
  color: var(--accent, #f59e0b);
}

.track-list-item__artist {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-muted, #a1a1aa);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Duration ── */
.track-list-item__duration {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-muted, #a1a1aa);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

/* ── Play button ── */
.track-list-item__play {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: var(--radius-full, 9999px);
  background: var(--accent, #f59e0b);
  color: var(--surface-1, #121214);
  cursor: pointer;
  opacity: 0;
  transition:
    opacity var(--dur-fast, 150ms) var(--ease-out, ease-out),
    background var(--dur-fast, 150ms) var(--ease-out, ease-out),
    transform var(--dur-fast, 150ms) var(--ease-spring, ease);
  flex-shrink: 0;
}

.track-list-item:hover .track-list-item__play,
.track-list-item:focus-within .track-list-item__play {
  opacity: 1;
}

.track-list-item__play:hover {
  background: var(--accent-hover, #d97706);
  transform: scale(1.05);
}

.track-list-item__play:active {
  transform: scale(0.95);
}

.track-list-item__play svg {
  width: 1.25rem;
  height: 1.25rem;
}

@media (prefers-reduced-motion: reduce) {
  .track-list-item,
  .track-list-item__play {
    transition: none;
  }
}
</style>
