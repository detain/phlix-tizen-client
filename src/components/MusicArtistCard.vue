/**
 * MusicArtistCard — displays a music artist with poster art and album count.
 *
 * Clicking navigates to the artist's album list.
 *
 * TV-SPECIFIC: This component is kept locally because:
 *   1. phlix-ui's MusicArtistCard lacks a full descriptive aria-label summarizing
 *      artist info for screen reader users (name + album count)
 *   2. The tizen version also lacks i18n (hardcoded "album/albums" string) - a
 *      quality regression that should be addressed if ever consolidated
 *
 * Merge is possible if phlix-ui adds a full aria-label and i18n support.
 *
 * @category TV-Specific Component
 * @duplicate phlix-ui/src/components/MusicArtistCard.vue - phlix-ui version lacks
 *   descriptive aria-label and i18n, making tizen version justified for now
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import type { MusicArtist } from '@phlix/contracts';

interface Props {
  /** The artist to display. */
  artist: MusicArtist;
}

defineProps<Props>();

const emit = defineEmits<{
  /** Fired when the user selects this artist. */
  (e: 'select', id: number): void;
}>();
</script>

<template>
  <article
    class="music-artist-card"
    role="button"
    tabindex="0"
    :aria-label="`${artist.name}${artist.albumCount ? `, ${artist.albumCount} albums` : ''}`"
    @click="emit('select', artist.id)"
    @keydown.enter="emit('select', artist.id)"
    @keydown.space.prevent="emit('select', artist.id)"
  >
    <div class="music-artist-card__poster-wrap">
      <img
        v-if="artist.imageUrl"
        :src="artist.imageUrl"
        :alt="`Photo of ${artist.name}`"
        class="music-artist-card__poster"
        loading="lazy"
      />
      <div
        v-else
        class="music-artist-card__poster music-artist-card__poster--placeholder"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      </div>
    </div>

    <div class="music-artist-card__info">
      <h3 class="music-artist-card__name">{{ artist.name }}</h3>
      <span v-if="artist.albumCount" class="music-artist-card__albums">
        {{ artist.albumCount }} {{ artist.albumCount === 1 ? 'album' : 'albums' }}
      </span>
    </div>
  </article>
</template>

<style scoped>
.music-artist-card {
  display: flex;
  flex-direction: column;
  background: var(--surface-2, #1f1f23);
  border: 1px solid var(--border-subtle, #3f3f46);
  border-radius: var(--radius-lg, 0.5rem);
  overflow: hidden;
  cursor: pointer;
  transition:
    background var(--dur-fast, 150ms) var(--ease-out, ease-out),
    border-color var(--dur-fast, 150ms) var(--ease-out, ease-out),
    transform var(--dur-fast, 150ms) var(--ease-spring, ease);
  outline: none;
}

.music-artist-card:hover {
  background: var(--surface-3, #27272a);
  border-color: var(--border-strong, #52525b);
}

.music-artist-card:focus-visible {
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
  border-color: var(--accent, #f59e0b);
}

.music-artist-card:active {
  transform: scale(0.97);
}

/* ── Poster ── */
.music-artist-card__poster-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--surface-3, #27272a);
  overflow: hidden;
}

.music-artist-card__poster {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.music-artist-card__poster--placeholder {
  display: grid;
  place-items: center;
  color: var(--text-muted, #a1a1aa);
}

.music-artist-card__poster--placeholder svg {
  width: 40%;
  height: 40%;
  opacity: 0.5;
}

/* ── Info ── */
.music-artist-card__info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
  padding: var(--space-3, 0.75rem);
}

.music-artist-card__name {
  font-size: var(--text-base, 1rem);
  font-weight: 600;
  color: var(--text, #e4e4e7);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.music-artist-card__albums {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-muted, #a1a1aa);
}

@media (prefers-reduced-motion: reduce) {
  .music-artist-card {
    transition: none;
  }
  .music-artist-card:active {
    transform: none;
  }
}
</style>
