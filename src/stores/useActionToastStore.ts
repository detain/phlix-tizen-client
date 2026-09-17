/**
 * useActionToastStore — transient "active control" captions for the TV (S516 / AD-13,
 * queue generalised by S526 / AD-10).
 *
 * A TV has no hover. The viewer only learns which control the D-pad landed on
 * (or what a transport key just did) if the app SAYS so. This store owns that
 * caption feed and self-clears each line ~1 s later — a glanceable echo, never
 * a modal.
 *
 * S516 shipped ONE slot: a re-show replaced whatever was up, so a burst of
 * rapid transient actions (queue add/remove, subtitle/audio switching) clobbered
 * each other and only the last survived. S526 generalises the slot into a
 * BOUNDED FIFO: announcements arrive in order, at most `ACTION_TOAST_QUEUE_CAP`
 * wait their turn, the OLDEST is evicted at the cap, and exactly ONE timer is
 * ever armed (draining the queue re-arms the same single window). The S510
 * no-stack rule stands in the only way that matters: the RENDERER still shows
 * one caption at a time — ordering lives here, in the store.
 *
 * The noise-suppression posture is preserved deliberately:
 *   - empty text is refused (focus landing on an unlabelled control announces
 *     nothing — only actionable labels reach the viewer);
 *   - a caption identical to the CURRENT one restarts its window instead of
 *     stacking (held-key repeats refresh, exactly as S516 pinned);
 *   - a caption identical to the last QUEUED one is dropped (rapid arrows across
 *     the same poster row cannot refill the queue with echoes);
 *   - `dismiss()` (the NEXT keypress) skips the current caption forward;
 *   - `clear()` wipes current AND queue — unmount/invisible = zero announce.
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

/**
 * Bound on WAITING captions (not counting the one on screen). A TV burst that
 * outruns the 1 s glance window evicts the OLDEST pending echo — recency wins,
 * the feed can never grow without limit.
 */
export const ACTION_TOAST_QUEUE_CAP = 5;

export const useActionToastStore = defineStore('actionToast', () => {
  /** The single VISIBLE caption slot — null means nothing is showing. */
  const caption = ref<string | null>(null);
  /** Ordered waiting room (FIFO); the visible caption is never in here. */
  const queue = ref<string[]>([]);
  /**
   * Monotonic re-show counter. Identical consecutive captions (`'Play/Pause'`
   * twice) still bump it so a renderer can restart its animation window even
   * though `caption` did not textually change — and every queue advance bumps
   * it too.
   */
  const nonce = ref(0);
  /** At most ONE timer armed at a time (S510 rule, carried into the queue). */
  let clearTimer: ReturnType<typeof setTimeout> | null = null;

  const visible = computed(() => caption.value !== null);
  /** How many announcements are waiting behind the visible one. */
  const pending = computed(() => queue.value.length);

  function clearTimerIfArmed(): void {
    if (clearTimer !== null) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }
  }

  function armAutoClear(): void {
    clearTimerIfArmed();
    clearTimer = setTimeout(() => {
      clearTimer = null;
      caption.value = null;
      drainNext();
    }, ACTION_TOAST_AUTO_CLEAR_MS);
  }

  /** Surface the next queued caption (if any) in the single slot, one window each. */
  function drainNext(): void {
    if (queue.value.length === 0) return;
    caption.value = queue.value.shift() as string;
    nonce.value += 1;
    armAutoClear();
  }

  /**
   * Announce `text` — NOW when the slot is free, otherwise in order behind
   * whatever is already waiting. Guards keep the S516 noise posture: blank
   * refused, identical-visible refreshes, identical-tail dropped, cap evicts
   * the oldest.
   */
  function show(text: string): void {
    if (text === '') return; // an empty caption is not a thing to echo
    if (caption.value === null && clearTimer === null) {
      caption.value = text;
      nonce.value += 1;
      armAutoClear();
      return;
    }
    if (caption.value === text) {
      // Held-key repeats of the same action: refresh the ONE window (S516 pin).
      nonce.value += 1;
      armAutoClear();
      return;
    }
    if (queue.value[queue.value.length - 1] === text) return; // echo already pending
    queue.value.push(text);
    while (queue.value.length > ACTION_TOAST_QUEUE_CAP) {
      queue.value.shift(); // oldest evicted at the cap
    }
  }

  /**
   * Skip forward NOW — the remote key the viewer pressed is itself the
   * dismissal of the CURRENT caption; queued announcements advance into the
   * freed slot (bounded, one window each) instead of being silently clobbered.
   */
  function dismiss(): void {
    clearTimerIfArmed();
    caption.value = null;
    drainNext();
  }

  /**
   * Wipe everything — current AND queued. This is what unmount/hide calls: an
   * invisible surface announces NOTHING, ever (AC-1).
   */
  function clear(): void {
    clearTimerIfArmed();
    queue.value = [];
    caption.value = null;
  }

  return { caption, queue, nonce, visible, pending, show, dismiss, clear };
});
