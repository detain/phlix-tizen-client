<script setup lang="ts">
/**
 * SubtitleTracksPage — S407 consumer for SubtitleTrackList.
 *
 * The picker component has existed since P3B (typed honestly since S404) but
 * had ZERO consumers — this page mounts it. Tracks come from the registered
 * `GET /api/v1/media/{id}/playback-info` rail (`subtitle_tracks`, server
 * StreamTrackShaper shape) via the SHARED S407 loader exported by
 * AudioTracksPage.vue — the client-side URL literal stays at exactly one
 * occurrence, so the route gate's per-file census is untouched.
 *
 * SELECTION IS AN OBSERVABLE EFFECT (unlike the audio page's named refusal):
 * the vendored `@phlix/ui#v0.99.0` player store exposes `setSubtitle(lang)` +
 * `subtitleLang`, and the ui Player consumes it — dist/player.js resolves
 * `track.language === subtitleLang` over the `<video>` textTracks.
 *
 * NAMED UI BOUNDARY (the language↔id vocabulary gap): the picker keys rows by
 * the WIRE `track.id`, but the store (and HTML5 textTracks) key subtitles by
 * LANGUAGE — textTracks have no wire ids. This page resolves id→language at
 * the dispatch boundary (`onSelect(track)` → `setSubtitle(track.language)`)
 * and derives `activeTrackId` back by matching `subtitleLang` against the
 * rows' language, FIRST MATCH WINS. Consequence, stated honestly: two wire
 * rows sharing one language are indistinguishable store-side — highlighting
 * marks the first, and selecting either produces the same player effect.
 * That is the @phlix/ui boundary; extending it is a ui/contracts conversation,
 * not this client's call.
 *
 * S511 (AD-18) — LANGUAGE PREFERENCE MEMORY. Because subtitle choice is a real
 * observable effect here, this page both READS and WRITES the ladder: on load
 * it adopts the per-item→server preferred subtitle language as the default (via
 * `setSubtitle`, ONLY when the viewer has not already chosen this session, so
 * absent preference stays byte-identical — AC2), and on select it persists the
 * choice through `useTrackPreferenceStore` (existing settings endpoint, AC3).
 * The account language rides `GET/PUT /api/v1/users/me/settings`; the literals
 * live in the store, so this page's route-gate census stays untouched.
 *
 * Route: /app/subtitle-tracks/:id  (registered via buildExtraRoutes in main.ts)
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApiBase, usePlayerStore } from '@phlix/ui';
import type { SubtitleTrack } from '@phlix/contracts';
import SubtitleTrackList from '../components/SubtitleTrackList.vue';
import { fetchPlaybackInfoTracks } from './AudioTracksPage.vue';
import { useTrackPreferenceStore } from '../stores/useTrackPreferenceStore';
import { tTizen } from '../i18n/tizen';

const route = useRoute();
const router = useRouter();
const apiBase = useApiBase();
const playerStore = usePlayerStore();
const trackPreference = useTrackPreferenceStore();

const subtitleTracks = ref<SubtitleTrack[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const mediaId = computed(() => String(route.params.id ?? ''));

/**
 * Active row derived from the store's LANGUAGE state (see the id↔language
 * boundary note in the header): the FIRST wire row whose language matches
 * `subtitleLang` is highlighted; no match (including subtitles-off) → null,
 * which the picker renders as the active "Off" row.
 */
const activeTrackId = computed<string | null>(() => {
  const lang = playerStore.subtitleLang;
  if (lang === null) return null;
  return subtitleTracks.value.find((t) => t.language === lang)?.id ?? null;
});

async function loadSubtitleTracks(): Promise<void> {
  const id = mediaId.value;
  if (!id) {
    error.value = tTizen('common.noMediaId');
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    // Rows pass through VERBATIM as the contracts wire `SubtitleTrack` —
    // no hand-map (S404 ruling; same shape discipline as the audio page).
    const response = await fetchPlaybackInfoTracks(apiBase.value, id);
    subtitleTracks.value = response.subtitle_tracks ?? [];

    // S511: adopt the remembered language as the DEFAULT, but only when the
    // viewer has not already chosen this session (`subtitleLang === null`).
    // resolveDefault reads per-item memory + the account preference; when
    // neither names an available row it returns null and we change nothing —
    // AC2's byte-identical absent-preference path.
    if (playerStore.subtitleLang === null) {
      if (!trackPreference.loaded) {
        await trackPreference.load(apiBase.value);
      }
      const resolved = trackPreference.resolveDefault(
        id,
        'subtitle',
        subtitleTracks.value.map((t) => t.language),
      );
      if (resolved.language !== null) {
        playerStore.setSubtitle(resolved.language);
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : tTizen('subtitleTracks.loadFailed');
    subtitleTracks.value = [];
  } finally {
    loading.value = false;
  }
}

/**
 * Dispatch the OBSERVABLE effect: hand the store the selected row's LANGUAGE
 * (the ui Player matches textTracks on it). `null` (the picker's "Off" row)
 * turns subtitles off. Then return to the player, where the change applies.
 *
 * S511: a real (non-off) choice is also remembered — per-item immediately and
 * pushed to the account via the existing settings endpoint. Turning subtitles
 * OFF is a session action, not a stored preference, so only a positive language
 * is persisted.
 */
function onSelectTrack(track: SubtitleTrack | null): void {
  const language = track?.language ?? null;
  playerStore.setSubtitle(language);
  if (language !== null) {
    void trackPreference.persist(apiBase.value, mediaId.value, 'subtitle', language);
  }
  void router.back();
}

function goBack(): void {
  void router.back();
}

onMounted(loadSubtitleTracks);
watch(mediaId, loadSubtitleTracks);
</script>

<template>
  <div class="subtitle-tracks-page">
    <header class="subtitle-tracks-page__header">
      <button
        class="subtitle-tracks-page__back"
        type="button"
        :aria-label="tTizen('common.goBack')"
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
      <h1 class="subtitle-tracks-page__title">
        <template v-if="loading">
          {{ tTizen('subtitleTracks.loadingTitle') }}
        </template>
        <template v-else-if="subtitleTracks.length">
          {{ tTizen(subtitleTracks.length === 1 ? 'subtitleTracks.headingOne' : 'subtitleTracks.headingOther', { count: subtitleTracks.length }) }}
        </template>
        <template v-else>
          {{ tTizen('subtitleTracks.title') }}
        </template>
      </h1>
    </header>

    <div
      v-if="loading"
      class="subtitle-tracks-page__loading"
      role="status"
      aria-busy="true"
      :aria-label="tTizen('subtitleTracks.loadingAria')"
    >
      <p>{{ tTizen('subtitleTracks.loading') }}</p>
    </div>

    <div
      v-else-if="error"
      class="subtitle-tracks-page__error"
      role="alert"
    >
      <p>{{ error }}</p>
      <button
        type="button"
        class="subtitle-tracks-page__retry"
        @click="loadSubtitleTracks"
      >
        {{ tTizen('common.retry') }}
      </button>
    </div>

    <div
      v-else-if="subtitleTracks.length === 0"
      class="subtitle-tracks-page__empty"
    >
      <p>{{ tTizen('subtitleTracks.empty') }}</p>
    </div>

    <template v-else>
      <p class="subtitle-tracks-page__boundary">
        {{ tTizen('subtitleTracks.languageNote') }}
      </p>
      <SubtitleTrackList
        :tracks="subtitleTracks"
        :active-track-id="activeTrackId"
        :on-select="onSelectTrack"
      />
    </template>
  </div>
</template>

<style scoped>
.subtitle-tracks-page {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: var(--space-6, 1.5rem);
}

.subtitle-tracks-page__header {
  display: flex;
  align-items: center;
  gap: var(--space-4, 1rem);
  margin-bottom: var(--space-6, 1.5rem);
  padding-bottom: var(--space-4, 1rem);
  border-bottom: 1px solid var(--border-subtle, #3f3f46);
}

.subtitle-tracks-page__back {
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

.subtitle-tracks-page__back svg {
  width: 1.25rem;
  height: 1.25rem;
}

.subtitle-tracks-page__back:hover {
  background: var(--surface-3, #27272a);
  color: var(--text, #e4e4e7);
}

.subtitle-tracks-page__back:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.subtitle-tracks-page__title {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: var(--text-2xl, 1.5rem);
  font-weight: 700;
  color: var(--text, #e4e4e7);
  margin: 0;
}

.subtitle-tracks-page__loading,
.subtitle-tracks-page__error,
.subtitle-tracks-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4, 1rem);
  padding: var(--space-10, 2.5rem);
  text-align: center;
  color: var(--text-muted, #a1a1aa);
}

.subtitle-tracks-page__retry {
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

.subtitle-tracks-page__retry:hover {
  background: var(--surface-3, #27272a);
  border-color: var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.subtitle-tracks-page__retry:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.subtitle-tracks-page__boundary {
  margin: 0 0 var(--space-3, 0.75rem);
  color: var(--text-subtle, #71717a);
  font-size: var(--text-xs, 0.75rem);
}

@media (prefers-reduced-motion: reduce) {
  .subtitle-tracks-page__back,
  .subtitle-tracks-page__retry {
    transition: none;
  }
}
</style>
