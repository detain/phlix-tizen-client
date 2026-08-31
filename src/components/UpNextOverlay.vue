<script setup lang="ts">
/**
 * UpNextOverlay — end-of-video "Up next" card shown before credits.
 *
 * Displays next media's poster thumbnail, title, "Up next" eyebrow,
 * a countdown ring (amber depleting arc, 8 seconds default), and
 * "Play now" / "Cancel" actions.
 *
 * This is a portal-rendered overlay that positions itself over the player area.
 * Styled for a dark TV UI (nocturne theme) with D-pad navigation support.
 *
 * TV-SPECIFIC: This component uses polling (250ms) to track player position
 * for visibility, whereas phlix-ui's UpNextCard uses reactive props. This is
 * tech debt but necessary for the TV webview context. Consolidation requires
 * migrating Tizen to phlix-ui's reactive pattern.
 *
 * @category TV-Specific Component
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ApiClient } from '@phlix/ui';
import { useApiBase, usePlayerStore } from '@phlix/ui';
import type { MediaItem } from '@phlix/contracts';

/** Envelope of `GET /api/v1/users/me/next-up` (WebPortalRouter::getNextUp). */
interface NextUpApiResponse {
  items?: MediaItem[];
}

const props = withDefaults(
  defineProps<{
    media?: MediaItem | null;
    remaining?: number;
    total?: number;
    counting?: boolean;
    posterUrl?: string | null;
  }>(),
  {
    media: null,
    remaining: 8,
    total: 8,
    counting: false,
    posterUrl: null,
  }
);

const emit = defineEmits<{
  'play-now': [];
  cancel: [];
}>();

const route = useRoute();
const apiBase = useApiBase();
const playerStore = usePlayerStore();

/** Current media item ID from the player route */
const mediaId = computed(() => String(route.params.id ?? ''));

/** Player position in seconds (updated via polling) */
const currentPosition = ref(0);

/** Player duration in seconds */
const currentDuration = ref(0);

/** Up next media item */
const upNextMedia = ref<MediaItem | null>(null);

/** Whether we have fetched up next info */
const loading = ref(false);

let positionInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Compute progress percentage for the countdown ring.
 * Returns a value 0-100 representing how much time remains.
 */
const progressPercent = computed(() => {
  if (props.total <= 0) return 100;
  return Math.max(0, Math.min(100, (props.remaining / props.total) * 100));
});

/**
 * SVG circle radius and circumference for the countdown ring.
 * Ring diameter is 48px, so radius is 20 (leaving 4px for stroke width).
 */
const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Stroke dash offset for the countdown ring.
 * As remaining decreases, the dash offset increases (ring depletes).
 */
const strokeDashoffset = computed(() => {
  const progress = progressPercent.value / 100;
  return RING_CIRCUMFERENCE * (1 - progress);
});

/**
 * Whether we are within range to show the up next overlay.
 * Shows when position is within `remaining` seconds of end.
 */
const showUpNext = computed(() => {
  if (!upNextMedia.value) return false;
  if (!props.counting) return false;
  const posSeconds = currentPosition.value;
  const durSeconds = currentDuration.value;
  if (durSeconds <= 0) return false;
  // Show when we are within `remaining` seconds of the end
  return durSeconds - posSeconds <= (props.remaining ?? 8);
});

/**
 * Load the up-next media from the registered Next-Up rail.
 *
 * S280 finding: this component previously called
 * `GET /api/v1/media/{id}/playlist`, a route phlix-server never registered —
 * the fetch always failed and the overlay silently never showed. The server's
 * "what plays next" rail is `GET /api/v1/users/me/next-up` (`{items: […]}`,
 * next unwatched episode per series, already ordered); the head of that list
 * is the auto-advance candidate, mirroring the roku client's next-up handling.
 * In practice the playing item is absent from the list (it is started, hence
 * not "up next"); the id filter below makes that defensive against a
 * not-yet-positioned pick.
 */
async function loadUpNextMedia(): Promise<void> {
  const id = mediaId.value;
  if (!id) return;

  loading.value = true;

  try {
    const client = new ApiClient({ baseUrl: apiBase.value });
    const response = await client.get<NextUpApiResponse>(
      `/api/v1/users/me/next-up`,
    );

    // Head of the rail is the auto-advance candidate; skip a not-yet-
    // positioned pick of the SAME item so the overlay never "up nexts" itself.
    upNextMedia.value = response.items?.find((item) => item.id !== id) ?? null;
  } catch {
    upNextMedia.value = null;
  } finally {
    loading.value = false;
  }
}

/**
 * Play the up next media now.
 */
function playNow(): void {
  emit('play-now');
}

/**
 * Cancel the up next and dismiss the overlay.
 */
function cancel(): void {
  emit('cancel');
}

/**
 * Poll player position and duration.
 */
function startPositionPolling(): void {
  positionInterval = setInterval(() => {
    const state = playerStore;
    if (!state) return;

    const storeAny = state as unknown as Record<string, unknown>;
    const pos = storeAny.position ?? storeAny.currentTime ?? storeAny.time ?? storeAny.current_position ?? 0;
    const dur = storeAny.duration ?? storeAny.totalDuration ?? storeAny.duration_seconds ?? 0;

    if (typeof pos === 'number' && pos >= 0) {
      currentPosition.value = pos;
    }
    if (typeof dur === 'number' && dur > 0) {
      currentDuration.value = dur;
    }
  }, 250);
}

function stopPositionPolling(): void {
  if (positionInterval) {
    clearInterval(positionInterval);
    positionInterval = null;
  }
}

// Watch for media item changes and reload up next info
watch(mediaId, (newId) => {
  if (newId) {
    void loadUpNextMedia();
    currentPosition.value = 0;
    currentDuration.value = 0;
  }
});

// Auto-advance when countdown reaches 0
watch(() => props.remaining, (newVal) => {
  if (newVal !== undefined && newVal <= 0 && props.counting) {
    emit('play-now');
  }
});

onMounted(() => {
  void loadUpNextMedia();
  startPositionPolling();
});

onUnmounted(() => {
  stopPositionPolling();
});
</script>

<template>
  <div
    v-if="showUpNext && upNextMedia"
    class="up-next-overlay"
    role="dialog"
    aria-modal="false"
    aria-label="Up next"
  >
    <div class="up-next-overlay__card">
      <!-- Poster thumbnail -->
      <div class="up-next-overlay__poster">
        <img
          v-if="upNextMedia.poster_url || posterUrl"
          :src="upNextMedia.poster_url || posterUrl || ''"
          :alt="upNextMedia.name"
          class="up-next-overlay__poster-image"
        >
        <div
          v-else
          class="up-next-overlay__poster-placeholder"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect
              x="2"
              y="2"
              width="20"
              height="20"
              rx="2.18"
              ry="2.18"
            />
            <line
              x1="7"
              y1="2"
              x2="7"
              y2="22"
            />
            <line
              x1="17"
              y1="2"
              x2="17"
              y2="22"
            />
            <line
              x1="2"
              y1="12"
              x2="22"
              y2="12"
            />
            <line
              x1="2"
              y1="7"
              x2="7"
              y2="7"
            />
            <line
              x1="2"
              y1="17"
              x2="7"
              y2="17"
            />
            <line
              x1="17"
              y1="17"
              x2="22"
              y2="17"
            />
            <line
              x1="17"
              y1="7"
              x2="22"
              y2="7"
            />
          </svg>
        </div>
      </div>

      <!-- Content -->
      <div class="up-next-overlay__content">
        <span class="up-next-overlay__eyebrow">Up next</span>
        <h3 class="up-next-overlay__title">
          {{ upNextMedia.name }}
        </h3>
      </div>

      <!-- Countdown ring -->
      <div class="up-next-overlay__countdown">
        <svg
          viewBox="0 0 48 48"
          class="up-next-overlay__ring"
          aria-hidden="true"
        >
          <!-- Background ring (muted) -->
          <circle
            cx="24"
            cy="24"
            :r="RING_RADIUS"
            fill="none"
            stroke="var(--surface-3, #27272a)"
            stroke-width="4"
          />
          <!-- Progress ring (amber depleting) -->
          <circle
            cx="24"
            cy="24"
            :r="RING_RADIUS"
            fill="none"
            stroke="var(--accent, #f59e0b)"
            stroke-width="4"
            stroke-linecap="round"
            :stroke-dasharray="RING_CIRCUMFERENCE"
            :stroke-dashoffset="strokeDashoffset"
            transform="rotate(-90 24 24)"
            class="up-next-overlay__ring-progress"
          />
        </svg>
        <span class="up-next-overlay__countdown-text">{{ remaining }}</span>
      </div>

      <!-- Actions -->
      <div class="up-next-overlay__actions">
        <button
          class="up-next-overlay__button up-next-overlay__button--play"
          type="button"
          aria-label="Play now"
          @click="playNow"
          @keydown.enter="playNow"
          @keydown.space.prevent="playNow"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span>Play Now</span>
        </button>

        <button
          class="up-next-overlay__button up-next-overlay__button--cancel"
          type="button"
          aria-label="Cancel"
          @click="cancel"
          @keydown.enter="cancel"
          @keydown.space.prevent="cancel"
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
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          <span>Cancel</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.up-next-overlay {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 150;
  pointer-events: auto;
  animation: slideUp 300ms var(--ease-out, ease-out);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.up-next-overlay__card {
  display: flex;
  align-items: center;
  gap: var(--space-4, 1rem);
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid var(--border-subtle, #3f3f46);
  border-radius: var(--radius-lg, 0.5rem);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(245, 158, 11, 0.1);
  min-width: 480px;
}

.up-next-overlay__poster {
  flex-shrink: 0;
  width: 80px;
  height: 45px;
  border-radius: var(--radius-sm, 0.25rem);
  overflow: hidden;
  background: var(--surface-2, #1f1f23);
}

.up-next-overlay__poster-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.up-next-overlay__poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted, #a1a1aa);
}

.up-next-overlay__poster-placeholder svg {
  width: 32px;
  height: 32px;
}

.up-next-overlay__content {
  flex: 1;
  min-width: 0;
}

.up-next-overlay__eyebrow {
  display: block;
  font-size: var(--text-xs, 0.75rem);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--accent, #f59e0b);
  margin-bottom: var(--space-1, 0.25rem);
}

.up-next-overlay__title {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: var(--text-base, 1rem);
  font-weight: 600;
  color: var(--text, #e4e4e7);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.up-next-overlay__countdown {
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.up-next-overlay__ring {
  width: 100%;
  height: 100%;
}

.up-next-overlay__ring-progress {
  transition: stroke-dashoffset 250ms linear;
}

.up-next-overlay__countdown-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: var(--text-sm, 0.875rem);
  font-weight: 700;
  color: var(--accent, #f59e0b);
}

.up-next-overlay__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
  flex-shrink: 0;
}

.up-next-overlay__button {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  border: 2px solid transparent;
  border-radius: var(--radius-md, 0.375rem);
  font-size: var(--text-sm, 0.875rem);
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--dur-fast, 150ms) var(--ease-out, ease-out),
    border-color var(--dur-fast, 150ms) var(--ease-out, ease-out),
    transform var(--dur-fast, 150ms) var(--ease-spring, ease);
  outline: none;
  white-space: nowrap;
}

.up-next-overlay__button svg {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.up-next-overlay__button--play {
  background: var(--accent, #f59e0b);
  color: #000;
  border-color: var(--accent, #f59e0b);
}

.up-next-overlay__button--play:hover {
  background: #d97706;
  border-color: #d97706;
}

.up-next-overlay__button--play:focus-visible {
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.up-next-overlay__button--play:active {
  transform: scale(0.97);
}

.up-next-overlay__button--cancel {
  background: rgba(0, 0, 0, 0.5);
  color: var(--text-muted, #a1a1aa);
  border-color: var(--border-subtle, #3f3f46);
}

.up-next-overlay__button--cancel:hover {
  background: rgba(39, 39, 42, 0.8);
  color: var(--text, #e4e4e7);
  border-color: var(--text-muted, #a1a1aa);
}

.up-next-overlay__button--cancel:focus-visible {
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.up-next-overlay__button--cancel:active {
  transform: scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .up-next-overlay {
    animation: none;
  }

  .up-next-overlay__ring-progress {
    transition: none;
  }

  .up-next-overlay__button,
  .up-next-overlay__button:active {
    transition: none;
  }

  .up-next-overlay__button:active {
    transform: none;
  }
}
</style>
