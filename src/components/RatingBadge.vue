<script setup lang="ts">
/**
 * RatingBadge — displays a media score (0–10 scale) as a 5‑star visual with
 * half‑star precision and a "7.5 / 10" numerical label.
 *
 * Styled for a dark TV UI (nocturne theme). Stars use CSS custom properties so
 * they inherit the correct amber/gold hue from the theme when available.
 */

import { computed } from 'vue'

interface Props {
  /** 0–10 score; null renders an em‑dash placeholder. */
  score: number | null
}

const props = defineProps<Props>()

/**
 * Convert a 0–10 score to a 0–5 star fill level with half‑star precision.
 * e.g. 7.5 → 3.75 stars, 9 → 4.5 stars, 10 → 5 stars.
 */
function scoreToStars(score: number): number {
  if (score == null || score < 0) return 0
  if (score > 10) return 5
  return score / 2
}

/** Binary mask: each entry is [full, half, empty] for one star slot. */
type StarSlot = [boolean, boolean, boolean]
type StarMask = [StarSlot, StarSlot, StarSlot, StarSlot, StarSlot]

function buildStarMask(score: number): StarMask {
  const filled = scoreToStars(score ?? 0)
  const mask: StarMask = [
    [false, false, false],
    [false, false, false],
    [false, false, false],
    [false, false, false],
    [false, false, false],
  ]

  for (let i = 0; i < 5; i++) {
    const remain = filled - i
    if (remain >= 1) {
      mask[i] = [true, false, false] // full
    } else if (remain >= 0.5) {
      mask[i] = [false, true, false] // half
    } else {
      mask[i] = [false, false, true] // empty
    }
  }

  return mask
}

const starMask = computed(() => buildStarMask(props.score ?? 0))
</script>

<template>
  <div
    class="rating-badge"
    role="img"
    :aria-label="`Rating: ${score ?? 'unrated'} out of 10`"
  >
    <div
      class="stars"
      aria-hidden="true"
    >
      <template
        v-for="(slot, idx) in starMask"
        :key="idx"
      >
        <span
          class="star"
          :class="{ 'star--full': slot[0], 'star--half': slot[1], 'star--empty': slot[2] }"
        >
          <svg
            v-if="slot[0]"
            viewBox="0 0 20 20"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <svg
            v-else-if="slot[1]"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                :id="`half-${idx}`"
                x1="0"
                x2="1"
                y1="0"
                y2="0"
              >
                <stop
                  offset="50%"
                  stop-color="currentColor"
                />
                <stop
                  offset="50%"
                  stop-color="transparent"
                />
              </linearGradient>
            </defs>
            <path
              :fill="`url(#half-${idx})`"
              d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
            />
          </svg>
          <svg
            v-else
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </span>
      </template>
    </div>

    <span class="score-label">{{ score != null ? `${score.toFixed(1)} / 10` : '—' }}</span>
  </div>
</template>

<style scoped>
.rating-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text, #e0e0e0);
}

.stars {
  display: inline-flex;
  gap: 2px;
}

.star {
  display: inline-block;
  width: 1.25rem;
  height: 1.25rem;
  color: #f59e0b; /* amber-500, TV-safe gold */
}

.star svg {
  width: 100%;
  height: 100%;
}

.star--empty {
  color: #52525b; /* zinc-600, muted empty slot */
}

.score-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-muted, #a1a1aa);
  letter-spacing: 0.01em;
  white-space: nowrap;
}
</style>
