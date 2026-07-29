<script setup lang="ts">
/**
 * PiPController — picture-in-picture toggle for the player.
 *
 * Checks if PiP is supported via `document.pictureInPictureEnabled` and
 * provides a toggle button to enter/exit PiP mode on the video element.
 *
 * This is a portal-rendered overlay that positions itself over the player area.
 * Styled for a dark TV UI (nocturne theme) with D-pad navigation support.
 *
 * TV-SPECIFIC: phlix-ui implements browser standard PiP in Player.vue directly.
 * This component is specifically for Samsung Tizen PiP API integration which
 * differs from standard browser PiP. No phlix-ui equivalent for TV-specific API.
 *
 * @category TV-Specific Component
 * @duplicate No phlix-ui equivalent - Samsung Tizen PiP API integration
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { ref, onMounted, onUnmounted } from 'vue';

const isPipSupported = ref(false);
const isPipActive = ref(false);

/** Check if Picture-in-Picture is supported and enabled */
function checkPipSupport(): boolean {
  if (typeof document === 'undefined') return false;
  return 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled === true;
}

/** Find the player video element */
function findVideoElement(): HTMLVideoElement | null {
  if (typeof document === 'undefined') return null;
  // Try common selectors for phlix-ui player video
  return (
    document.querySelector<HTMLVideoElement>('.player video') ||
    document.querySelector<HTMLVideoElement>('.phlix-player video') ||
    document.querySelector<HTMLVideoElement>('video:not([src=""])') ||
    document.querySelector<HTMLVideoElement>('video')
  );
}

/** Enter Picture-in-Picture mode */
async function enterPip(): Promise<void> {
  const video = findVideoElement();
  if (!video) return;

  try {
    await video.requestPictureInPicture();
  } catch (err) {
    // PiP failed - could be unsupported or permission denied
    console.warn('PiP request failed:', err);
  }
}

/** Exit Picture-in-Picture mode */
async function exitPip(): Promise<void> {
  if (document.pictureInPictureElement) {
    try {
      await document.exitPictureInPicture();
    } catch (err) {
      console.warn('PiP exit failed:', err);
    }
  }
}

/** Toggle Picture-in-Picture mode */
async function togglePip(): Promise<void> {
  if (isPipActive.value) {
    await exitPip();
  } else {
    await enterPip();
  }
}

/** Handle video element events */
function handleVideoEvent(event: Event): void {
  if (event.type === 'enterpictureinpicture') {
    isPipActive.value = true;
  } else if (event.type === 'leavepictureinpicture') {
    isPipActive.value = false;
  }
}

/** Set up video element listeners for PiP events */
function setupVideoListeners(): void {
  const video = findVideoElement();
  if (!video) return;

  video.addEventListener('enterpictureinpicture', handleVideoEvent);
  video.addEventListener('leavepictureinpicture', handleVideoEvent);

  // Also listen on the document for PiP window events
  document.addEventListener('enterpictureinpicture', handleVideoEvent as EventListener);
  document.addEventListener('leavepictureinpicture', handleVideoEvent as EventListener);
}

/** Clean up video element listeners */
function cleanupVideoListeners(): void {
  const video = findVideoElement();
  if (video) {
    video.removeEventListener('enterpictureinpicture', handleVideoEvent);
    video.removeEventListener('leavepictureinpicture', handleVideoEvent);
  }

  document.removeEventListener('enterpictureinpicture', handleVideoEvent as EventListener);
  document.removeEventListener('leavepictureinpicture', handleVideoEvent as EventListener);
}

onMounted(() => {
  isPipSupported.value = checkPipSupport();
  setupVideoListeners();

  // Check initial state
  isPipActive.value = document.pictureInPictureElement !== null;
});

onUnmounted(() => {
  cleanupVideoListeners();
});
</script>

<template>
  <div
    v-if="isPipSupported"
    class="pip-controller"
  >
    <button
      class="pip-controller__button"
      :class="{ 'is-active': isPipActive }"
      type="button"
      :aria-pressed="isPipActive"
      :aria-label="isPipActive ? 'Exit picture-in-picture' : 'Enter picture-in-picture'"
      @click="togglePip"
      @keydown.enter="togglePip"
      @keydown.space.prevent="togglePip"
    >
      <svg
        v-if="!isPipActive"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect
          x="2"
          y="3"
          width="20"
          height="14"
          rx="2"
        />
        <rect
          x="12"
          y="11"
          width="8"
          height="6"
          rx="1"
          fill="currentColor"
          stroke="currentColor"
        />
      </svg>
      <svg
        v-else
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect
          x="2"
          y="3"
          width="20"
          height="14"
          rx="2"
        />
        <path
          d="M8 21h12a2 2 0 002-2v-4a2 2 0 00-2-2H8a2 2 0 00-2 2v4a2 2 0 002 2z"
          fill="currentColor"
        />
      </svg>
      <span class="pip-controller__label">
        {{ isPipActive ? 'Exit PiP' : 'PiP' }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.pip-controller {
  position: absolute;
  bottom: 80px;
  right: 20px;
  z-index: 150;
  pointer-events: auto;
}

.pip-controller__button {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  border: 2px solid var(--border-subtle, #3f3f46);
  border-radius: var(--radius-md, 0.375rem);
  background: rgba(0, 0, 0, 0.85);
  color: var(--text, #e4e4e7);
  cursor: pointer;
  transition:
    background var(--dur-fast, 150ms) var(--ease-out, ease-out),
    border-color var(--dur-fast, 150ms) var(--ease-out, ease-out),
    transform var(--dur-fast, 150ms) var(--ease-spring, ease);
  outline: none;
}

.pip-controller__button:hover {
  background: rgba(39, 39, 42, 0.9);
  border-color: var(--accent, #f59e0b);
  color: var(--accent, #f59e0b);
}

.pip-controller__button:focus-visible {
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(245, 158, 11, 0.5));
  border-color: var(--accent, #f59e0b);
}

.pip-controller__button:active {
  transform: scale(0.97);
}

.pip-controller__button.is-active {
  border-color: var(--accent, #f59e0b);
  color: var(--accent, #f59e0b);
  background: rgba(245, 158, 11, 0.1);
}

.pip-controller__button svg {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.pip-controller__label {
  font-size: var(--text-sm, 0.875rem);
  font-weight: 600;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .pip-controller__button {
    transition: none;
  }

  .pip-controller__button:active {
    transform: none;
  }
}
</style>
