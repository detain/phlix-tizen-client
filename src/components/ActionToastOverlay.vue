<script setup lang="ts">
/**
 * ActionToastOverlay — the single always-mounted caption surface (S516 / AD-13).
 *
 * Echoes, for ~1 s, what the remote just did or where the D-pad just landed:
 * a glance that replaces the hover a TV will never have. Three wires, one
 * visible slot — since S526 the SLOT stays single (ordered render) while the
 * store behind it is a bounded FIFO, so a burst of rapid actions announces IN
 * ORDER instead of clobbering:
 *
 *   - `RemoteManager 'action'` → caption via the repo's own `KeyMapping.getDisplayName`
 *     (PLAY_PAUSE → "Play/Pause", held-key repeats simply refresh the window);
 *   - document `focusin` → caption the newly focused control (aria-label →
 *     placeholder → trimmed text, length-capped) — the "focus-landed" echo;
 *   - document `keydown` → dismiss immediately (key-activatable dismissal: the
 *     NEXT press always clears the CURRENT caption; a press that also acts
 *     enqueues its own caption right after — the queue keeps BOTH, shown one
 *     at a time).
 *
 * FOCUS-SAFE (S512 blur/`tabindex=-1` containment doctrine, honored): the root
 * is `aria-hidden`, has NO `tabindex`, is `pointer-events: none`, and this
 * component never calls `focus()` on anything — showing a caption cannot move
 * D-pad/remote focus, and the toast is never itself a focus target.
 *
 * NON-BLOCKING: playback/navigation are untouched while it shows — it listens
 * only; it never preventDefaults, stops propagation, or awaits anything.
 *
 * COEXISTS-WITH S515 `renderBootFailure` BY CONSTRUCTION: that surface is
 * terminal — it only ever paints when `boot()` REJECTED, in which case this
 * overlay was never mounted (boot mounts it last). A successful boot shows
 * captions; a dead boot shows one readable error. The two surfaces can never
 * double-stack boot errors — there is no toast path into boot failure, and
 * boot failure writes only into `#phlix-app`/`body`.
 *
 * @category TV-Specific Component
 * @duplicate No phlix-ui equivalent — @phlix/ui's toast store carries
 * app-level messages (S510 hub-relay notice); this is key-level control echo
 * for a no-hover device, rendered as its own always-mounted root app like the
 * other TV overlays.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { onBeforeUnmount, onMounted } from 'vue';
import remoteManager, { type ActionEvent, type KeyEvent } from '../remote/RemoteManager';
import KeyMapping from '../remote/KeyMapping';
import { useActionToastStore } from '../stores/useActionToastStore';

/** Captions are a glance, not a paragraph — long labels truncate here. */
const MAX_CAPTION_CHARS = 48;

const toast = useActionToastStore();

// RemoteManager hands subscribers the ActionEvent|KeyEvent union; only the
// action shape carries `key`. (onAction() is typed but discards the
// unsubscribe fn — this app lives for the whole session yet registers the
// same T-05-cleanable way as every other listener.)
function captionAction(event: ActionEvent | KeyEvent): void {
  if ('key' in event) toast.show(KeyMapping.getDisplayName(event.key));
}

function describeFocusTarget(target: EventTarget | null): string {
  if (!(target instanceof HTMLElement)) return '';
  const raw =
    target.getAttribute('aria-label') ||
    target.getAttribute('placeholder') ||
    target.textContent ||
    '';
  const text = raw.replace(/\s+/g, ' ').trim();
  return text.length > MAX_CAPTION_CHARS ? `${text.slice(0, MAX_CAPTION_CHARS - 1)}…` : text;
}

function onFocusLanded(event: FocusEvent): void {
  toast.show(describeFocusTarget(event.target));
}

// Key-level dismissal reads the SAME global keydown the RemoteManager consumes;
// subscribing to its 'keydown' event keeps one capture source — the store's
// dismiss is a no-op when nothing shows, so ordinary typing is untouched.
function onKeyPressed(): void {
  toast.dismiss();
}

onMounted(() => {
  const unsubAction = remoteManager.on('action', captionAction);
  const unsubKeydown = remoteManager.on('keydown', onKeyPressed);
  document.addEventListener('focusin', onFocusLanded);
  onBeforeUnmount(() => {
    // T-05 doctrine: long-lived root apps unsubscribe on the hook that FIRES.
    unsubAction();
    unsubKeydown();
    document.removeEventListener('focusin', onFocusLanded);
    toast.dismiss(); // never leave a caption (or its timer) past unmount
  });
});
</script>

<template>
  <div
    v-if="toast.visible"
    :key="toast.nonce"
    class="action-toast"
    aria-hidden="true"
  >
    <span class="action-toast__dot" />
    <span class="action-toast__caption">{{ toast.caption }}</span>
  </div>
</template>

<style scoped>
/*
 * Bottom-third chrome above app content but far below the S515 boot splash
 * (z 2147483647) — the splash must always win while it is on screen. Amber
 * dot ties the echo to the nocturne accent; the pill stays legible over any
 * poster wall or fullscreen frame. pointer-events:none + no tabindex keep it
 * strictly non-interactive: nothing here can take a D-pad focus stop.
 */
.action-toast {
  position: fixed;
  left: 50%;
  bottom: 96px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 28px;
  border-radius: 999px;
  background: rgba(7, 7, 13, 0.88);
  border: 1px solid rgba(245, 165, 36, 0.35);
  box-shadow: 0 10px 36px -8px rgba(0, 0, 0, 0.72);
  color: #efece4;
  font: 500 26px/1.2 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.02em;
  z-index: 9000;
  pointer-events: none;
  animation: action-toast-in 180ms ease-out;
}
.action-toast__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #f5a524;
  box-shadow: 0 0 12px rgba(245, 165, 36, 0.8);
  flex: none;
}
.action-toast__caption {
  white-space: nowrap;
}
@keyframes action-toast-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
