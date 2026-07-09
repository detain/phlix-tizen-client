<script setup lang="ts">
/**
 * UserRatingPicker — interactive 5‑star rating input for the authenticated
 * user's personal rating on a media item.
 *
 * - Shows the current rating on mount (reads from `userRating`)
 * - Clicking a star level calls `PUT /api/v1/media/{id}/rating` via `ApiClient.setRating`
 * - Optimistic UI: the star updates immediately; reverts on error.
 * - TV D‑pad navigation via `@phlix/ui` `useSpatialNav` focus hooks.
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { ref, computed, onMounted } from 'vue'
import { useAuthStore, useToastStore } from '@phlix/ui'

interface Props {
  /** Media item id to attach the rating to. */
  mediaId: string
  /** Initial rating (0–10 scale, already fetched from the API). */
  userRating: number | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  /** Fired when the user successfully updates their rating. */
  'rating-changed': [rating: number | null]
}>()

const auth = useAuthStore()
const toast = useToastStore()

const hoveredStar = ref<number | null>(null)
const submitting = ref(false)

/** Map 0–5 star index to 0–10 rating value (×2). */
function starToRating(starIndex: number): number {
  return starIndex * 2
}

/** Convert 0–10 rating to 0–5 star display. */
function ratingToStars(rating: number | null): number {
  if (rating == null) return 0
  return Math.round(rating / 2)
}

/** The star index to highlight: hovered star takes precedence over confirmed rating. */
const activeStars = computed(() => {
  if (hoveredStar.value != null) return hoveredStar.value
  return ratingToStars(props.userRating)
})

/** Convert 0–5 star index to filled/half/empty state. */
type StarState = 'full' | 'half' | 'empty'
function starState(starIdx: number, active: number): StarState {
  if (starIdx < active) return 'full'
  if (starIdx === Math.floor(active) && active % 1 !== 0) return 'half'
  return 'empty'
}

/** Handle star click: submit rating to API. */
async function selectStar(starIndex: number) {
  if (submitting.value) return
  const newRating = starToRating(starIndex)
  // Same star → toggle off (clear rating)
  const finalRating = newRating === props.userRating ? null : newRating

  submitting.value = true
  try {
    await auth.client.setRating(props.mediaId, finalRating)
    emit('rating-changed', finalRating)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    toast.error(`Failed to save rating: ${msg}`, { duration: 4000 })
  } finally {
    submitting.value = false
  }
}

function handleKey(starIndex: number, event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    void selectStar(starIndex)
  }
}

onMounted(() => {
  // Ensure hover state clears when focus leaves the component
})
</script>

<template>
  <div
    class="user-rating-picker"
    role="group"
    aria-label="Rate this media"
  >
    <span class="picker-label">Your rating</span>

    <div
      class="stars-row"
      role="radiogroup"
      :aria-label="`Current rating: ${userRating ?? 0} of 10`"
    >
      <button
        v-for="starIdx in 5"
        :key="starIdx"
        type="button"
        class="star-btn"
        :class="[`star-btn--${starState(starIdx - 1, activeStars)}`]"
        :aria-checked="ratingToStars(userRating) === starIdx"
        :aria-label="`${starIdx} star${starIdx > 1 ? 's' : ''} (${starToRating(starIdx)} of 10)`"
        role="radio"
        :tabindex="starIdx === 1 ? 0 : -1"
        :disabled="submitting"
        @click="void selectStar(starIdx)"
        @keydown="(e) => handleKey(starIdx, e)"
        @mouseenter="hoveredStar = starIdx"
        @mouseleave="hoveredStar = null"
        @focus="hoveredStar = starIdx"
        @blur="hoveredStar = null"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      </button>
    </div>

    <span
      v-if="userRating != null"
      class="rating-value"
    >
      {{ userRating.toFixed(0) }} / 10
    </span>
    <span
      v-else
      class="rating-value rating-value--unset"
    >Not rated</span>
  </div>
</template>

<style scoped>
.user-rating-picker {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
}

.picker-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-subtle, #a1a1aa);
}

.stars-row {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}

.star-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #52525b; /* zinc-600 empty */
  transition: color 120ms ease-out, transform 120ms ease-out;
  border-radius: 4px;
}

.star-btn:focus-visible {
  outline: 2px solid var(--accent-ring, #f59e0b);
  outline-offset: 2px;
}

.star-btn:not(:disabled):hover,
.star-btn:not(:disabled):focus {
  transform: scale(1.15);
}

.star-btn--full,
.star-btn--half {
  color: #f59e0b; /* amber-500 */
}

.star-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.star-btn svg {
  width: 100%;
  height: 100%;
}

.rating-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-muted, #a1a1aa);
}

.rating-value--unset {
  font-style: italic;
  color: var(--text-subtle, #71717a);
}
</style>
