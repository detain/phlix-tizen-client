/**
 * useActionToastStore — transient "active control" captions for the TV (S516 / AD-13).
 *
 * A TV has no hover. The viewer only learns which control the D-pad landed on
 * (or what a transport key just did) if the app SAYS so. This store owns that
 * one caption slot: `show(text)` paints it, and it self-clears ~1 s later — a
 * glanceable echo, never a modal, never stacked.
 *
 * The discipline is inherited from S510's hub-relay notice (the estate's
 * transient-toast precedent): exactly ONE slot, re-arming replaces rather than
 * stacks, and at most ONE timer is ever armed. `ActionToastOverlay.vue` is its
 * only renderer (always mounted as its own root app); nothing else may paint
 * competing action captions.
 *
 * Focus-safe by contract: this store renders nothing and touches no DOM — the
 * overlay is presentational (`aria-hidden`, no `tabindex`, never focused), so
 * showing a caption can never steal D-pad/remote focus (S512 containment).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

/** How long a caption stays up before the store self-clears it (~1 s — glance, not reading). */
export const ACTION_TOAST_AUTO_CLEAR_MS = 1000;

export const useActionToastStore = defineStore('actionToast', () => {
  /** The single caption slot — null means nothing is showing. */
  const caption = ref<string | null>(null);
  /**
   * Monotonic re-show counter. Identical consecutive captions (`'Play/Pause'`
   * twice) still bump it so a renderer can restart its animation window even
   * though `caption` did not textually change.
   */
  const nonce = ref(0);
  /** At most ONE timer armed at a time (S510 rule). */
  let clearTimer: ReturnType<typeof setTimeout> | null = null;

  const visible = computed(() => caption.value !== null);

  function clearTimerIfArmed(): void {
    if (clearTimer !== null) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }
  }

  /** Paint `text` for ~1 s. Re-showing replaces the slot and re-arms the single timer. */
  function show(text: string): void {
    if (text === '') return; // an empty caption is not a thing to echo
    caption.value = text;
    nonce.value += 1;
    clearTimerIfArmed();
    clearTimer = setTimeout(() => {
      clearTimer = null;
      caption.value = null;
    }, ACTION_TOAST_AUTO_CLEAR_MS);
  }

  /** Dismiss NOW — the remote key the viewer pressed is itself the dismissal. */
  function dismiss(): void {
    clearTimerIfArmed();
    caption.value = null;
  }

  return { caption, nonce, visible, show, dismiss };
});
