<script setup lang="ts">
/**
 * SleepTimerOverlay — sleep timer overlay for the player.
 *
 * Provides preset duration options (5/10/15/30/45/60 min) plus a custom option
 * that the user can set. When the timer expires, it pauses playback.
 *
 * This is a portal-rendered overlay that positions itself over the player area.
 * Styled for a dark TV UI (nocturne theme) with D-pad navigation support.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { ref, computed } from 'vue';
import { usePlayerStore } from '@phlix/ui';

interface SleepTimerPreset {
  label: string;
  minutes: number;
}

const PRESETS: SleepTimerPreset[] = [
  { label: '5 min', minutes: 5 },
  { label: '10 min', minutes: 10 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '60 min', minutes: 60 },
];

const playerStore = usePlayerStore();

const isVisible = ref(false);
const selectedPresetIndex = ref<number | null>(null);
const customMinutes = ref(15);
const timerEndTime = ref<number | null>(null);

let timerInterval: ReturnType<typeof setInterval> | null = null;
let timerTimeout: ReturnType<typeof setTimeout> | null = null;

const remainingSeconds = ref(0);

const isTimerActive = computed(() => timerEndTime.value !== null);

const remainingTimeDisplay = computed(() => {
  if (!isTimerActive.value) return '';
  const mins = Math.floor(remainingSeconds.value / 60);
  const secs = remainingSeconds.value % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
});

function show(): void {
  isVisible.value = true;
  selectedPresetIndex.value = null;
}

function hide(): void {
  isVisible.value = false;
  selectedPresetIndex.value = null;
}

function toggle(): void {
  if (isVisible.value) {
    hide();
  } else {
    show();
  }
}

function selectPreset(index: number): void {
  selectedPresetIndex.value = index;
  startTimer(PRESETS[index].minutes);
  hide();
}

function startCustomTimer(): void {
  if (customMinutes.value > 0 && customMinutes.value <= 180) {
    startTimer(customMinutes.value);
    hide();
  }
}

function startTimer(minutes: number): void {
  cancelTimer();

  const endTime = Date.now() + minutes * 60 * 1000;
  timerEndTime.value = endTime;

  timerTimeout = setTimeout(() => {
    playerStore.pause();
    cancelTimer();
  }, minutes * 60 * 1000);

  timerInterval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((timerEndTime.value! - Date.now()) / 1000));
    remainingSeconds.value = remaining;
    if (remaining <= 0) {
      cancelTimer();
    }
  }, 1000);
}

function cancelTimer(): void {
  if (timerTimeout) {
    clearTimeout(timerTimeout);
    timerTimeout = null;
  }
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerEndTime.value = null;
  remainingSeconds.value = 0;
}

function cancel(): void {
  cancelTimer();
  hide();
}

// Expose toggle for external access (e.g., from a button in the player chrome)
defineExpose({
  show,
  hide,
  toggle,
  isTimerActive,
  remainingTimeDisplay,
});
</script>

<template>
  <div
    v-if="isVisible"
    class="sleep-timer-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Sleep timer"
  >
    <div class="sleep-timer-overlay__panel">
      <header class="sleep-timer-overlay__header">
        <h2 class="sleep-timer-overlay__title">
          Sleep Timer
        </h2>
        <button
          class="sleep-timer-overlay__close"
          type="button"
          aria-label="Close sleep timer"
          @click="hide"
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
        </button>
      </header>

      <div class="sleep-timer-overlay__presets">
        <button
          v-for="(preset, index) in PRESETS"
          :key="preset.minutes"
          class="sleep-timer-overlay__preset"
          :class="{ 'is-selected': selectedPresetIndex === index }"
          type="button"
          :aria-pressed="selectedPresetIndex === index"
          @click="selectPreset(index)"
        >
          {{ preset.label }}
        </button>
      </div>

      <div class="sleep-timer-overlay__custom">
        <label class="sleep-timer-overlay__custom-label">
          Custom (minutes):
          <input
            v-model.number="customMinutes"
            type="number"
            class="sleep-timer-overlay__custom-input"
            min="1"
            max="180"
            aria-label="Custom timer duration in minutes"
          >
        </label>
        <button
          class="sleep-timer-overlay__custom-start"
          type="button"
          @click="startCustomTimer"
        >
          Start Custom
        </button>
      </div>

      <p
        v-if="isTimerActive"
        class="sleep-timer-overlay__status"
      >
        Timer active: {{ remainingTimeDisplay }} remaining
      </p>

      <button
        v-if="isTimerActive"
        class="sleep-timer-overlay__cancel"
        type="button"
        @click="cancel"
      >
        Cancel Timer
      </button>
    </div>
  </div>

  <!-- Small indicator when timer is running but overlay is hidden -->
  <div
    v-if="isTimerActive && !isVisible"
    class="sleep-timer-overlay__indicator"
    aria-live="polite"
    aria-label="Sleep timer active"
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
      <circle
        cx="12"
        cy="12"
        r="10"
      />
      <path d="M12 6v6l4 2" />
    </svg>
    <span>{{ remainingTimeDisplay }}</span>
  </div>
</template>

<style scoped>
.sleep-timer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  z-index: 200;
}

.sleep-timer-overlay__panel {
  width: 100%;
  max-width: 400px;
  background: var(--surface-2, #1f1f23);
  border: 1px solid var(--border-subtle, #3f3f46);
  border-radius: var(--radius-lg, 0.5rem);
  padding: var(--space-6, 1.5rem);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.sleep-timer-overlay__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6, 1.5rem);
}

.sleep-timer-overlay__title {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: var(--text-xl, 1.25rem);
  font-weight: 700;
  color: var(--text, #e4e4e7);
  margin: 0;
}

.sleep-timer-overlay__close {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: var(--radius-md, 0.375rem);
  background: transparent;
  color: var(--text-muted, #a1a1aa);
  cursor: pointer;
  transition: background var(--dur-fast, 150ms) var(--ease-out, ease-out),
    color var(--dur-fast, 150ms) var(--ease-out, ease-out);
}

.sleep-timer-overlay__close svg {
  width: 1.25rem;
  height: 1.25rem;
}

.sleep-timer-overlay__close:hover {
  background: var(--surface-3, #27272a);
  color: var(--text, #e4e4e7);
}

.sleep-timer-overlay__close:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.sleep-timer-overlay__presets {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2, 0.5rem);
  margin-bottom: var(--space-6, 1.5rem);
}

.sleep-timer-overlay__preset {
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  border: 1px solid var(--border-subtle, #3f3f46);
  border-radius: var(--radius-md, 0.375rem);
  background: var(--surface-3, #27272a);
  color: var(--text, #e4e4e7);
  font-size: var(--text-sm, 0.875rem);
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--dur-fast, 150ms) var(--ease-out, ease-out),
    border-color var(--dur-fast, 150ms) var(--ease-out, ease-out),
    transform var(--dur-fast, 150ms) var(--ease-spring, ease);
  outline: none;
}

.sleep-timer-overlay__preset:hover {
  background: var(--surface-4, #303030);
  border-color: var(--accent, #f59e0b);
}

.sleep-timer-overlay__preset:focus-visible {
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
  border-color: var(--accent, #f59e0b);
}

.sleep-timer-overlay__preset:active {
  transform: scale(0.97);
}

.sleep-timer-overlay__preset.is-selected {
  background: var(--accent, #f59e0b);
  border-color: var(--accent, #f59e0b);
  color: #000;
}

.sleep-timer-overlay__custom {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  padding-top: var(--space-4, 1rem);
  border-top: 1px solid var(--border-subtle, #3f3f46);
}

.sleep-timer-overlay__custom-label {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  flex: 1;
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-muted, #a1a1aa);
}

.sleep-timer-overlay__custom-input {
  width: 5rem;
  padding: var(--space-2, 0.5rem);
  border: 1px solid var(--border-subtle, #3f3f46);
  border-radius: var(--radius-md, 0.375rem);
  background: var(--surface-3, #27272a);
  color: var(--text, #e4e4e7);
  font-size: var(--text-sm, 0.875rem);
  text-align: center;
}

.sleep-timer-overlay__custom-input:focus {
  outline: none;
  border-color: var(--accent, #f59e0b);
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.sleep-timer-overlay__custom-start {
  padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
  border: 1px solid var(--accent, #f59e0b);
  border-radius: var(--radius-md, 0.375rem);
  background: transparent;
  color: var(--accent, #f59e0b);
  font-size: var(--text-sm, 0.875rem);
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--dur-fast, 150ms) var(--ease-out, ease-out),
    color var(--dur-fast, 150ms) var(--ease-out, ease-out);
  white-space: nowrap;
}

.sleep-timer-overlay__custom-start:hover {
  background: var(--accent, #f59e0b);
  color: #000;
}

.sleep-timer-overlay__custom-start:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

.sleep-timer-overlay__status {
  margin-top: var(--space-4, 1rem);
  padding: var(--space-3, 0.75rem);
  background: var(--surface-3, #27272a);
  border-radius: var(--radius-md, 0.375rem);
  color: var(--accent, #f59e0b);
  font-size: var(--text-sm, 0.875rem);
  font-weight: 600;
  text-align: center;
}

.sleep-timer-overlay__cancel {
  width: 100%;
  margin-top: var(--space-3, 0.75rem);
  padding: var(--space-3, 0.75rem);
  border: 1px solid var(--border-strong, #52525b);
  border-radius: var(--radius-md, 0.375rem);
  background: transparent;
  color: var(--text-muted, #a1a1aa);
  font-size: var(--text-sm, 0.875rem);
  cursor: pointer;
  transition:
    background var(--dur-fast, 150ms) var(--ease-out, ease-out),
    color var(--dur-fast, 150ms) var(--ease-out, ease-out);
}

.sleep-timer-overlay__cancel:hover {
  background: var(--surface-3, #27272a);
  color: var(--text, #e4e4e7);
}

.sleep-timer-overlay__cancel:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
}

/* Timer indicator when overlay is hidden but timer is running */
.sleep-timer-overlay__indicator {
  position: fixed;
  bottom: 100px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid var(--accent, #f59e0b);
  border-radius: var(--radius-md, 0.375rem);
  color: var(--accent, #f59e0b);
  font-size: var(--text-sm, 0.875rem);
  font-weight: 600;
  z-index: 150;
  pointer-events: none;
}

.sleep-timer-overlay__indicator svg {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .sleep-timer-overlay__preset,
  .sleep-timer-overlay__preset:active,
  .sleep-timer-overlay__close,
  .sleep-timer-overlay__custom-start,
  .sleep-timer-overlay__cancel {
    transition: none;
  }

  .sleep-timer-overlay__preset:active {
    transform: none;
  }
}
</style>
