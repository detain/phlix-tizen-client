<script setup lang="ts">
/**
 * RecommendationCard — displays a single "Because You Watched" recommendation.
 *
 * Shows the poster (or a placeholder), title, year, similarity score as a
 * percentage, and a "Because You Watched" reason badge. Clicking navigates
 * to the player for that media item.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import type { UserRecommendation } from '@phlix/contracts';

interface Props {
  /** The recommendation to display. */
  item: UserRecommendation;
}

defineProps<Props>();

const emit = defineEmits<{
  /** Fired when the user selects this recommendation. */
  (e: 'select', id: string): void;
}>();
</script>

<template>
  <article
    class="recommendation-card"
    role="button"
    tabindex="0"
    :aria-label="`${item.title}${item.year ? ` (${item.year})` : ''} — ${Math.round(item.score * 100)}% match`"
    @click="emit('select', item.id)"
    @keydown.enter="emit('select', item.id)"
    @keydown.space.prevent="emit('select', item.id)"
  >
    <div class="recommendation-card__poster-wrap">
      <img
        v-if="item.posterUrl"
        :src="item.posterUrl"
        :alt="`Poster for ${item.title}`"
        class="recommendation-card__poster"
        loading="lazy"
      />
      <div v-else class="recommendation-card__poster recommendation-card__poster--placeholder" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M2 8h20M7 12l3-2 3 3 3-4 2 2" />
        </svg>
      </div>
    </div>

    <div class="recommendation-card__info">
      <h3 class="recommendation-card__title">{{ item.title }}</h3>
      <div class="recommendation-card__meta">
        <span v-if="item.year" class="recommendation-card__year">{{ item.year }}</span>
        <span class="recommendation-card__score">{{ Math.round(item.score * 100) }}% match</span>
      </div>
      <span class="recommendation-card__reason">Because You Watched</span>
    </div>
  </article>
</template>

<style scoped>
.recommendation-card {
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

.recommendation-card:hover {
  background: var(--surface-3, #27272a);
  border-color: var(--border-strong, #52525b);
}

.recommendation-card:focus-visible {
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
  border-color: var(--accent, #f59e0b);
}

.recommendation-card:active {
  transform: scale(0.97);
}

/* ── Poster ── */
.recommendation-card__poster-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  background: var(--surface-3, #27272a);
  overflow: hidden;
}

.recommendation-card__poster {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.recommendation-card__poster--placeholder {
  display: grid;
  place-items: center;
  color: var(--text-muted, #a1a1aa);
}

.recommendation-card__poster--placeholder svg {
  width: 40%;
  height: 40%;
  opacity: 0.5;
}

/* ── Info ── */
.recommendation-card__info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
  padding: var(--space-3, 0.75rem);
}

.recommendation-card__title {
  font-size: var(--text-base, 1rem);
  font-weight: 600;
  color: var(--text, #e4e4e7);
  margin: 0;
  /* Truncate long titles gracefully */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.recommendation-card__meta {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  flex-wrap: wrap;
}

.recommendation-card__year {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-muted, #a1a1aa);
}

.recommendation-card__score {
  font-size: var(--text-sm, 0.875rem);
  font-weight: 600;
  color: var(--accent, #f59e0b);
  font-variant-numeric: tabular-nums;
}

.recommendation-card__reason {
  display: inline-block;
  margin-top: var(--space-1, 0.25rem);
  padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
  border-radius: var(--radius-sm, 0.25rem);
  background: var(--accent-dim, rgba(245, 158, 11, 0.15));
  color: var(--accent, #f59e0b);
  font-size: var(--text-xs, 0.75rem);
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  align-self: flex-start;
}

@media (prefers-reduced-motion: reduce) {
  .recommendation-card {
    transition: none;
  }
  .recommendation-card:active {
    transform: none;
  }
}
</style>
