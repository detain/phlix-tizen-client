<script setup lang="ts">
/**
 * ChaptersPage — displays the chapter list for a media item.
 *
 * Fetches chapters from `GET /api/v1/media/{id}/chapters`. Each chapter row
 * navigates to the player with a seek command so playback starts at the
 * selected chapter's start time.
 *
 * Route: /app/chapters/:id  (registered via buildExtraRoutes in main.ts)
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiClient } from '@phlix/ui';
import { useApiBase } from '@phlix/ui';
import { usePlayerStore } from '@phlix/ui';
import type { ChapterMarker } from '@phlix/contracts';
import ChapterList from '../components/ChapterList.vue';

interface ChapterApiResponse {
  chapters: ChapterMarker[];
}

const route = useRoute();
const router = useRouter();
const apiBase = useApiBase();
const playerStore = usePlayerStore();

const chapters = ref<ChapterMarker[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const mediaId = computed(() => String(route.params.id ?? ''));

async function loadChapters(): Promise<void> {
  const id = mediaId.value;
  if (!id) {
    error.value = 'No media id provided';
    loading.value = false;
    return;
  }

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
 * Seek to the given chapter's start time (in milliseconds) and navigate
 * to the player for the current media item.
 */
function onSeek(startMs: number): void {
  // Convert milliseconds to seconds for seekTo
  const startSeconds = startMs / 1000;
  playerStore.seekTo(startSeconds);
  void router.push({ name: 'player', params: { id: mediaId.value } });
}

function goBack(): void {
  void router.back();
}

onMounted(loadChapters);
watch(mediaId, loadChapters);
</script>

<template>
  <div class="chapters-page">
    <header class="chapters-page__header">
      <button
        class="chapters-page__back"
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
      <h1 class="chapters-page__title">
        <template v-if="loading">Chapters…</template>
        <template v-else-if="chapters.length">
          {{ chapters.length }} {{ chapters.length === 1 ? 'Chapter' : 'Chapters' }}
        </template>
        <template v-else>Chapters</template>
      </h1>
    </header>

    <div
      v-if="loading"
      class="chapters-page__loading"
      role="status"
      aria-busy="true"
      aria-label="Loading chapters"
    >
      <p>Loading chapters…</p>
    </div>

    <div
      v-else-if="error"
      class="chapters-page__error"
      role="alert"
    >
      <p>{{ error }}</p>
      <button
        type="button"
        class="chapters-page__retry"
        @click="loadChapters"
      >
        Retry
      </button>
    </div>

    <div
      v-else-if="chapters.length === 0"
      class="chapters-page__empty"
    >
      <p>No chapters available for this media.</p>
    </div>

    <template v-else>
      <ChapterList
        :chapters="chapters"
        :on-seek="onSeek"
      />
    </template>
  </div>
</template>

<style scoped>
.chapters-page {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: var(--space-6, 1.5rem);
}

.chapters-page__header {
  display: flex;
  align-items: center;
  gap: var(--space-4, 1rem);
  margin-bottom: var(--space-6, 1.5rem);
  padding-bottom: var(--space-4, 1rem);
  border-bottom: 1px solid var(--border-subtle, #3f3f46);
}

.chapters-page__back {
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

.chapters-page__back svg {
  width: 1.25rem;
  height: 1.25rem;
}

.chapters-page__back:hover {
  background: var(--surface-3, #27272a);
  color: var(--text, #e4e4e7);
}

.chapters-page__back:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.chapters-page__title {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: var(--text-2xl, 1.5rem);
  font-weight: 700;
  color: var(--text, #e4e4e7);
  margin: 0;
}

.chapters-page__loading,
.chapters-page__error,
.chapters-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4, 1rem);
  padding: var(--space-10, 2.5rem);
  text-align: center;
  color: var(--text-muted, #a1a1aa);
}

.chapters-page__retry {
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

.chapters-page__retry:hover {
  background: var(--surface-3, #27272a);
  border-color: var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.chapters-page__retry:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

@media (prefers-reduced-motion: reduce) {
  .chapters-page__back,
  .chapters-page__retry {
    transition: none;
  }
}
</style>
