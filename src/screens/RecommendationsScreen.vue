<script setup lang="ts">
/**
 * RecommendationsScreen — "For You" recommendation grid.
 *
 * Fetches personalized "Because You Watched" recommendations from
 * `GET /api/v1/me/recommendations?limit=20` and displays them as a grid of
 * `RecommendationCard` components.
 *
 * Route: /app/recommendations  (registered via buildExtraRoutes in main.ts)
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ApiClient } from '@phlix/ui';
import { useApiBase } from '@phlix/ui';
import type { UserRecommendation } from '@phlix/contracts';
import RecommendationCard from '../components/RecommendationCard.vue';

interface RecommendationApiResponse {
  recommendations: UserRecommendation[];
}

const router = useRouter();
const apiBase = useApiBase();

const items = ref<UserRecommendation[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    const data = await client.get<RecommendationApiResponse>(
      '/api/v1/me/recommendations',
      { limit: '20' },
    );
    items.value = data.recommendations ?? [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load recommendations';
    items.value = [];
  } finally {
    loading.value = false;
  }
}

function onSelect(id: string): void {
  void router.push({ name: 'player', params: { id } });
}

function goBack(): void {
  void router.back();
}

onMounted(load);
</script>

<template>
  <div class="recommendations-screen">
    <header class="recommendations-screen__header">
      <button
        class="recommendations-screen__back"
        type="button"
        aria-label="Go back"
        @click="goBack"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="recommendations-screen__title">
        <template v-if="loading">
          For You…
        </template>
        <template v-else-if="items.length">
          {{ items.length }} Recommendations
        </template>
        <template v-else>
          For You
        </template>
      </h1>
    </header>

    <div
      v-if="loading"
      class="recommendations-screen__loading"
      role="status"
      aria-busy="true"
      aria-label="Loading recommendations"
    >
      <p>Loading recommendations…</p>
    </div>

    <div
      v-else-if="error"
      class="recommendations-screen__error"
      role="alert"
    >
      <p>{{ error }}</p>
      <button
        type="button"
        class="recommendations-screen__retry"
        @click="load"
      >
        Retry
      </button>
    </div>

    <div
      v-else-if="items.length === 0"
      class="recommendations-screen__empty"
    >
      <p>No recommendations yet. Keep watching to get personalized suggestions!</p>
    </div>

    <div
      v-else
      class="recommendations-screen__grid"
      role="list"
      :aria-label="`${items.length} recommendations`"
    >
      <RecommendationCard
        v-for="item in items"
        :key="item.id"
        :item="item"
        role="listitem"
        @select="onSelect"
      />
    </div>
  </div>
</template>

<style scoped>
.recommendations-screen {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-6, 1.5rem);
}

.recommendations-screen__header {
  display: flex;
  align-items: center;
  gap: var(--space-4, 1rem);
  margin-bottom: var(--space-8, 2rem);
  padding-bottom: var(--space-4, 1rem);
  border-bottom: 1px solid var(--border-subtle, #3f3f46);
}

.recommendations-screen__back {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: var(--radius-full, 9999px);
  background: var(--surface-2, #1f1f23);
  color: var(--text-muted, #a1a1aa);
  cursor: pointer;
  transition:
    background var(--dur-fast, 150ms) var(--ease-out, ease-out),
    color var(--dur-fast, 150ms) var(--ease-out, ease-out);
  flex-shrink: 0;
}

.recommendations-screen__back svg {
  width: 1.25rem;
  height: 1.25rem;
}

.recommendations-screen__back:hover {
  background: var(--surface-3, #27272a);
  color: var(--text, #e4e4e7);
}

.recommendations-screen__back:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.recommendations-screen__title {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: var(--text-3xl, 1.875rem);
  font-weight: 700;
  color: var(--text, #e4e4e7);
  margin: 0;
}

.recommendations-screen__loading,
.recommendations-screen__error,
.recommendations-screen__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4, 1rem);
  padding: var(--space-10, 2.5rem);
  text-align: center;
  color: var(--text-muted, #a1a1aa);
  min-height: 40vh;
}

.recommendations-screen__retry {
  padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
  border: 1px solid var(--border-strong, #52525b);
  border-radius: var(--radius-md, 0.375rem);
  background: var(--surface-2, #1f1f23);
  color: var(--text, #e4e4e7);
  font-size: var(--text-sm, 0.875rem);
  cursor: pointer;
  transition:
    background var(--dur-fast, 150ms) var(--ease-out, ease-out),
    border-color var(--dur-fast, 150ms) var(--ease-out, ease-out);
}

.recommendations-screen__retry:hover {
  background: var(--surface-3, #27272a);
  border-color: var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.recommendations-screen__retry:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

/* ── Grid ── */
.recommendations-screen__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-6, 1.5rem);
}

@media (max-width: 640px) {
  .recommendations-screen__grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--space-4, 1rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .recommendations-screen__back,
  .recommendations-screen__retry {
    transition: none;
  }
}
</style>
