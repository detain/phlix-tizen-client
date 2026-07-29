/**
 * MusicAlbumCard — displays a music album with cover art and track count.
 *
 * Clicking navigates to the album's track listing.
 *
 * TV-SPECIFIC: This component is kept locally because:
 *   1. phlix-ui's MusicAlbumCard lacks a full descriptive aria-label summarizing
 *      album info for screen reader users (title + year + track count)
 *   2. The tizen version also lacks i18n (hardcoded "tracks" string) - a quality
 *      regression that should be addressed if ever consolidated
 *
 * Merge is possible if phlix-ui adds a full aria-label and i18n support.
 *
 * @category TV-Specific Component
 * @duplicate phlix-ui/src/components/MusicAlbumCard.vue - phlix-ui version lacks
 *   descriptive aria-label and i18n, making tizen version justified for now
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import type { MusicAlbum } from '@phlix/contracts';

interface Props {
  /** The album to display. */
  album: MusicAlbum;
}

defineProps<Props>();

const emit = defineEmits<{
  /** Fired when the user selects this album. */
  (e: 'select', id: number): void;
}>();
</script>

<template>
  <article
    class="music-album-card"
    role="button"
    tabindex="0"
    :aria-label="`${album.title}${album.year ? ` (${album.year})` : ''} — ${album.totalTracks} tracks`"
    @click="emit('select', album.id)"
    @keydown.enter="emit('select', album.id)"
    @keydown.space.prevent="emit('select', album.id)"
  >
    <div class="music-album-card__cover-wrap">
      <img
        v-if="album.albumArtUrl"
        :src="album.albumArtUrl"
        :alt="`Album art for ${album.title}`"
        class="music-album-card__cover"
        loading="lazy"
      />
      <div
        v-else
        class="music-album-card__cover music-album-card__cover--placeholder"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </div>
    </div>

    <div class="music-album-card__info">
      <h3 class="music-album-card__title">{{ album.title }}</h3>
      <div class="music-album-card__meta">
        <span v-if="album.year" class="music-album-card__year">{{ album.year }}</span>
        <span class="music-album-card__tracks">
          {{ album.totalTracks }} {{ album.totalTracks === 1 ? 'track' : 'tracks' }}
        </span>
      </div>
      <span
        v-if="album.artist"
        class="music-album-card__artist"
      >
        {{ album.artist.name }}
      </span>
    </div>
  </article>
</template>

<style scoped>
.music-album-card {
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

.music-album-card:hover {
  background: var(--surface-3, #27272a);
  border-color: var(--border-strong, #52525b);
}

.music-album-card:focus-visible {
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
  border-color: var(--accent, #f59e0b);
}

.music-album-card:active {
  transform: scale(0.97);
}

/* ── Cover ── */
.music-album-card__cover-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--surface-3, #27272a);
  overflow: hidden;
}

.music-album-card__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.music-album-card__cover--placeholder {
  display: grid;
  place-items: center;
  color: var(--text-muted, #a1a1aa);
}

.music-album-card__cover--placeholder svg {
  width: 40%;
  height: 40%;
  opacity: 0.5;
}

/* ── Info ── */
.music-album-card__info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
  padding: var(--space-3, 0.75rem);
}

.music-album-card__title {
  font-size: var(--text-base, 1rem);
  font-weight: 600;
  color: var(--text, #e4e4e7);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.music-album-card__meta {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  flex-wrap: wrap;
}

.music-album-card__year {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-muted, #a1a1aa);
}

.music-album-card__tracks {
  font-size: var(--text-sm, 0.875rem);
  color: var(--accent, #f59e0b);
  font-weight: 500;
}

.music-album-card__artist {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-muted, #a1a1aa);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (prefers-reduced-motion: reduce) {
  .music-album-card {
    transition: none;
  }
  .music-album-card:active {
    transform: none;
  }
}
</style>
