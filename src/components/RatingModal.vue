<script setup lang="ts">
/**
 * RatingModal — overlay modal combining aggregate RatingBadge and personal
 * UserRatingPicker for a media item.
 *
 * Used on the media detail screen when the user clicks "Rate". The modal is
 * closed by the Escape key, clicking the backdrop, or the explicit close button.
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { ref, onMounted, onUnmounted } from 'vue'
import RatingBadge from './RatingBadge.vue'
import UserRatingPicker from './UserRatingPicker.vue'

interface Props {
  /** Media item being rated. */
  itemId: string
  /** Aggregate score (0–10), null if unrated. */
  aggregateScore: number | null
  /** Whether the modal is visible. */
  visible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** Fired when the modal requests to be closed. */
  'close': []
  /** Fired when the aggregate score might have changed (optimistic or confirmed). */
  'score-changed': [score: number | null]
}>()

// Local user rating state — synced with API on mount, updated optimistically
const userRating = ref<number | null>(null)
const loading = ref(true)

/** Fetch the user's existing rating for this item. */
async function fetchUserRating() {
  loading.value = true
  try {
    // The API doesn't have a GET for user rating, but we can check the media item's user_data
    // For now, we'll track it internally and via the API calls in UserRatingPicker
    userRating.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchUserRating()
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.visible) {
    emit('close')
  }
}

function handleBackdropClick() {
  emit('close')
}

function handleRatingChanged(newRating: number | null) {
  userRating.value = newRating
  // Emit score-changed so parent can update aggregate if needed
  emit('score-changed', newRating)
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="rating-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-modal-title"
        @click="handleBackdropClick"
      >
        <div
          class="rating-modal"
          role="document"
          @click.stop
        >
          <header class="modal-header">
            <h2
              id="rating-modal-title"
              class="modal-title"
            >Rate This Title</h2>
            <button
              type="button"
              class="close-btn"
              aria-label="Close rating modal"
              @click="handleClose"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div class="modal-body">
            <!-- Aggregate rating display -->
            <div class="aggregate-section">
              <span class="section-label">Community Rating</span>
              <RatingBadge :score="aggregateScore" />
            </div>

            <!-- Divider -->
            <div class="divider" />

            <!-- User's personal rating -->
            <div class="user-section">
              <span class="section-label">Your Rating</span>
              <UserRatingPicker
                :media-id="itemId"
                :user-rating="userRating"
                @rating-changed="handleRatingChanged"
              />
            </div>
          </div>

          <footer class="modal-footer">
            <p class="hint">Press <kbd>Esc</kbd> to close</p>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.rating-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
}

.rating-modal {
  background-color: var(--bg-primary, #18181b);
  border: 1px solid var(--border, #3f3f46);
  border-radius: 12px;
  width: 90%;
  max-width: 480px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border, #3f3f46);
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text, #fafafa);
  margin: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted, #a1a1aa);
  cursor: pointer;
  border-radius: 6px;
  transition: color 120ms ease-out, background-color 120ms ease-out;
}

.close-btn:hover,
.close-btn:focus-visible {
  color: var(--text, #fafafa);
  background-color: var(--bg-elevated, #27272a);
}

.close-btn:focus-visible {
  outline: 2px solid var(--accent, #f59e0b);
  outline-offset: 2px;
}

.close-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

.modal-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.aggregate-section,
.user-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-subtle, #71717a);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.divider {
  height: 1px;
  background-color: var(--border, #3f3f46);
  margin: 0.25rem 0;
}

.modal-footer {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--border, #3f3f46);
  text-align: center;
}

.hint {
  font-size: 0.75rem;
  color: var(--text-subtle, #71717a);
  margin: 0;
}

.hint kbd {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  font-family: inherit;
  font-size: 0.6875rem;
  background-color: var(--bg-elevated, #27272a);
  border: 1px solid var(--border, #3f3f46);
  border-radius: 4px;
}

/* Transition animations */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease-out;
}

.modal-enter-active .rating-modal,
.modal-leave-active .rating-modal {
  transition: transform 200ms ease-out, opacity 200ms ease-out;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .rating-modal,
.modal-leave-to .rating-modal {
  transform: scale(0.95) translateY(-10px);
  opacity: 0;
}
</style>
