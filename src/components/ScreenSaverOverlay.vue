<script setup lang="ts">
/**
 * ScreenSaverOverlay — the zero-privilege idle screensaver (S523 / AD-21).
 *
 * The always-mounted NINTH root app. The entire WHEN policy is pure and lives
 * in `../screensaver` (`shouldEngageScreenSaver`); this half only moves a
 * 1 s coarse clock, feeds it two live signals, and paints:
 *
 *   - `usePlayerStore().playing` — while playback is active every tick counts
 *     as activity, so the overlay NEVER engages during playback and the idle
 *     window after a pause starts from the pause, not from before the movie.
 *   - `RemoteManager 'keydown'` — the SAME global seam every routed remote key
 *     passes through (arrows included: RemoteManager emits keydown for every
 *     key it sees). Any key wakes instantly and re-arms the window.
 *
 * PRIVILEGE-HONEST (AC-1): this is the shipped half. The keep-awake half is
 * WITHHELD because `app/config.xml` as-shipped grants only `internet` +
 * `tv.inputdevice` — no `privilege/display` — and TN-2/S503 forbids
 * pre-adding privileges. See the docblock in `../screensaver` for the full
 * live-manifest verdict. The manifest is UNTOUCHED by this step.
 *
 * FOCUS-SAFE (S512/S516 doctrine, honored): the root is `aria-hidden`, has no
 * `tabindex`, is `pointer-events: none`, and this component never calls
 * `focus()`/`blur()` — the screensaver is presentational and can never become
 * a focus target or steal the D-pad. It never preventDefaults either: the
 * waking key still performs its normal action, exactly like every overlay
 * dismissal before it.
 *
 * BURN-IN POSTURE (jellyfin convention, adopted honestly): the idle const is
 * 180 s (localStorage-overridable via `phlix.screensaver.idleMs`), the artwork
 * is a slow 42 s drift + 7 s breathing halo — nothing static sits long enough
 * to etch an OSD, and playback itself vetoes the whole surface.
 *
 * @category TV-Specific Component
 * @duplicate No phlix-ui equivalent — @phlix/ui's idle concerns are the
 * sleep-timer (user-timed stop), not a device screen policy surface; like the
 * other TV chrome this mounts as its own always-mounted root app.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { usePlayerStore } from '@phlix/ui';
import remoteManager from '../remote/RemoteManager';
import {
  IDLE_BODY_CLASS,
  IDLE_TICK_MS,
  resolveIdleTimeoutMs,
  shouldEngageScreenSaver,
} from '../screensaver';

// Local, guarded storage accessor — mirrors TelemetryConsent (S521): the real
// localStorage when the webview allows it, a session-scoped shim when the
// privacy-mode getter throws. Kept local to avoid a main ↔ overlay import cycle.
const memory = new Map<string, string>();
const storage: Pick<Storage, 'getItem'> = (() => {
  try {
    const real = globalThis.localStorage;
    if (real) return real;
  } catch {
    // Getter threw — fall through to the shim below.
  }
  return {
    getItem: (k) => memory.get(k) ?? null,
  };
})();

const player = usePlayerStore();
const engaged = ref(false);

let lastActivityAt = Date.now();
let timeoutMs = resolveIdleTimeoutMs(storage);
let tickTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeKey: (() => void) | null = null;

function setEngaged(next: boolean): void {
  if (engaged.value === next) return;
  engaged.value = next;
  document.body.classList.toggle(IDLE_BODY_CLASS, next);
}

function onRoutedKey(): void {
  // Any key routed through the RemoteManager seam is activity: wake instantly
  // and re-arm the window. The key itself keeps its normal behavior (no
  // preventDefault, no stopPropagation — pure observer).
  lastActivityAt = Date.now();
  setEngaged(false);
}

function tick(): void {
  const now = Date.now();
  // Active playback IS continuous activity — refresh the stamp so the idle
  // window after a pause starts from the pause. The pure policy still holds
  // the absolute veto, so a stale/odd `playing` signal cannot mis-dim.
  if (player.playing) lastActivityAt = now;
  setEngaged(
    shouldEngageScreenSaver({
      now,
      lastActivityAt,
      timeoutMs,
      isPlaying: Boolean(player.playing),
    }),
  );
}

onMounted(() => {
  timeoutMs = resolveIdleTimeoutMs(storage);
  lastActivityAt = Date.now();
  unsubscribeKey = remoteManager.on('keydown', onRoutedKey);
  tickTimer = setInterval(tick, IDLE_TICK_MS);
});

onBeforeUnmount(() => {
  // T-05 doctrine for long-lived root apps: leave no poll, no subscription,
  // and no body class behind.
  if (tickTimer !== null) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  if (unsubscribeKey !== null) {
    unsubscribeKey();
    unsubscribeKey = null;
  }
  document.body.classList.remove(IDLE_BODY_CLASS);
  engaged.value = false;
});
</script>

<template>
  <div
    v-if="engaged"
    class="screensaver"
    aria-hidden="true"
    data-testid="screensaver-overlay"
  >
    <div class="screensaver__halo" />
    <div class="screensaver__drift">
      <p class="screensaver__wordmark">
        Phlix
      </p>
      <span class="screensaver__rule" />
      <p class="screensaver__hint">
        Press any key to wake
      </p>
    </div>
  </div>
</template>

<style scoped>
/*
 * Full-viewport idle artwork in the house nocturne/amber language — a committed
 * night sky with one ember, NOT a generic black rectangle. z 9500: above every
 * overlay app (toast 9000) while the boot splash (2147483647) still always
 * wins. pointer-events:none + no tabindex + aria-hidden: strictly un-focusable,
 * the remote keeps driving straight through it.
 * The 42 s drift and 7 s breath are one slow orchestration, not decoration
 * noise: they exist so no pixel of the artwork holds a fixed position while the
 * idle surface is up (burn-in risk class, jellyfin convention adopted).
 */
.screensaver {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(140% 100% at 50% 45%, #0e1020 0%, #07070d 58%, #030306 100%),
    #07070d;
  z-index: 9500;
  pointer-events: none;
  animation: screensaver-rise 1400ms ease-out;
}
.screensaver__drift {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 34px;
  animation: screensaver-drift 42s ease-in-out infinite alternate;
}
.screensaver__wordmark {
  font: 700 132px/1 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.14em;
  text-transform: none;
  color: transparent;
  background: linear-gradient(102deg, #efece4 12%, #f5a524 48%, #b97c14 66%, #efece4 92%);
  -webkit-background-clip: text;
  background-clip: text;
  text-shadow: 0 0 68px rgba(245, 165, 36, 0.22);
}
.screensaver__halo {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 64vw;
  height: 64vw;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(245, 165, 36, 0.12) 0%, rgba(245, 165, 36, 0.04) 38%, transparent 70%);
  animation: screensaver-breathe 7s ease-in-out infinite;
  z-index: -1;
}
.screensaver__rule {
  width: 260px;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(245, 165, 36, 0.85) 22% 78%, transparent);
}
.screensaver__hint {
  font: 400 24px/1.5 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: #8f94a8;
}
@keyframes screensaver-rise {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes screensaver-drift {
  from {
    transform: translate(-3.5vw, 1.5vh) rotate(-0.6deg);
  }
  to {
    transform: translate(3.5vw, -1.5vh) rotate(0.6deg);
  }
}
@keyframes screensaver-breathe {
  0%,
  100% {
    opacity: 0.45;
    transform: translate(-50%, -50%) scale(0.94);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.06);
  }
}
@media (prefers-reduced-motion: reduce) {
  .screensaver,
  .screensaver__drift,
  .screensaver__halo {
    animation: none;
  }
}
</style>
