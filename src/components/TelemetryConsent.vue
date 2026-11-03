<script setup lang="ts">
/**
 * TelemetryConsent — the ONE-TIME opt-in card for AD-27 client telemetry (S521).
 *
 * Shown ONLY while the install has never made a telemetry decision (consent key
 * UNSET) and a server base exists to talk to. The default is OFF — there is no
 * accept-by-default path, no pre-checked box, and once a choice is made the card
 * retires for good (`chosen`), so a "Not now" is honored and never re-nagged.
 *
 *   - Enable  → persists `true` and starts the guarded hourly heartbeat.
 *   - Not now → persists an explicit `false` and stops any sender.
 *
 * It never inspects titles, accounts, or anything personal — the payload lives
 * entirely in `../telemetry` (bounded, device-id only). The card just flips a
 * boolean and calls start/stop.
 *
 * FOCUS-SAFE (S512/S516 discipline, honored): it is a NON-BLOCKING bottom card —
 * it never covers the whole viewport, never traps focus, and calls no `focus()`.
 * Its two buttons are ordinary D-pad-reachable controls (no autofocus, so they
 * cannot steal focus on mount); spatial-nav / native focus reaches them exactly
 * like the quick-connect "Try again" button.
 *
 * @category TV-Specific Component
 * @duplicate No phlix-ui equivalent — this is the client-side privacy gate for
 * the TV's own consent-gated heartbeat, mounted as its own always-mounted root
 * app like the other TV chrome.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { computed, onBeforeUnmount, ref } from 'vue';
import { useApiBase } from '@phlix/ui';
import { tTizen } from '../i18n/tizen';
import { spatialTakeover } from '../spatial/focusCandidates';
import {
  buildTelemetryDeps,
  CONSENT_KEY,
  getConsent,
  setConsent,
  startTelemetry,
  stopTelemetry,
} from '../telemetry';

// Local, guarded storage accessor — mirrors what boot's probeStorage() writes to
// (the real localStorage), with a session-scoped shim if the webview refuses it.
// Kept local (not imported from main.ts) to avoid a main ↔ overlay import cycle.
const memory = new Map<string, string>();
const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = (() => {
  try {
    const real = globalThis.localStorage;
    if (real) return real;
  } catch {
    // Privacy-mode getter throws — fall through to the shim below.
  }
  return {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => {
      memory.set(k, v);
    },
    removeItem: (k) => {
      memory.delete(k);
    },
  };
})();

const apiBase = useApiBase();

/** Explicitly answered this session (retires the card even if storage refused). */
const answered = ref(false);
const consentUnset = !storage.getItem(CONSENT_KEY);

/** Show only for a never-decided install that already has a server to pair
 * with — and NOT while a full-bleed spatial takeover (the QuickConnect
 * pairing panel, z 12000) is on screen (M6 / review tizen__gameux): the card
 * used to sit buried under the takeover for the whole pairing ceremony, so
 * its buttons were invisible stops the D-pad could still fire blind. Now it
 * waits its turn — the reactive takeover mirror retires the card while the
 * panel is up and re-offers it the moment the takeover ends (dismissal or
 * completed login), so the one-time choice is never silently skipped. */
const visible = computed(
  () => consentUnset && !answered.value && Boolean(apiBase.value) && spatialTakeover.value === null
);

function enable(): void {
  setConsent(storage, true);
  answered.value = true;
  startTelemetry(buildTelemetryDeps({ storage, baseUrl: apiBase.value }));
}

function decline(): void {
  setConsent(storage, false);
  answered.value = true;
  stopTelemetry();
}

onBeforeUnmount(() => {
  // A card that disappears (e.g. the app unmounting it) must not leave a timer
  // running under an un-consented install; the sender's own consent re-check
  // already makes this belt-and-braces, but stop is the T-05-clean thing to do.
  if (!getConsent(storage)) stopTelemetry();
});
</script>

<template>
  <div
    v-if="visible"
    class="telemetry-consent"
    role="region"
    :aria-label="tTizen('telemetry.aria')"
  >
    <p class="telemetry-consent__title">
      {{ tTizen('telemetry.title') }}
    </p>
    <p class="telemetry-consent__body">
      {{ tTizen('telemetry.body') }}
    </p>
    <div class="telemetry-consent__actions">
      <button
        type="button"
        class="telemetry-consent__btn telemetry-consent__btn--yes"
        data-testid="telemetry-enable"
        @click="enable"
      >
        {{ tTizen('telemetry.enable') }}
      </button>
      <button
        type="button"
        class="telemetry-consent__btn telemetry-consent__btn--no"
        data-testid="telemetry-decline"
        @click="decline"
      >
        {{ tTizen('telemetry.notNow') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/*
 * Bottom-center card, translucent — deliberately NOT a full-bleed modal: it
 * informs without blocking browse, and its buttons are D-pad reachable in the
 * natural focus order. Amber accent + ink follow the shipped nocturne palette.
 */
.telemetry-consent {
  position: fixed;
  left: 50%;
  bottom: 64px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 900px;
  max-width: 92vw;
  padding: 30px 38px;
  border-radius: 20px;
  background: rgba(10, 11, 20, 0.94);
  border: 1px solid rgba(245, 165, 36, 0.32);
  box-shadow: 0 20px 60px -14px rgba(0, 0, 0, 0.8);
  color: #efece4;
  z-index: 9000;
}
.telemetry-consent__title {
  margin: 0;
  /* M-TIZEN-11: was `font: 700 34px/1.2` — split longhands, 36px rung. */
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-weight: 700;
  font-size: var(--text-lg);
  line-height: 1.2;
  letter-spacing: 0.01em;
}
.telemetry-consent__body {
  margin: 0;
  /* M-TIZEN-11: was `font: 400 22px/1.5` — 30px body rung at couch distance. */
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-weight: 400;
  font-size: var(--text-base);
  line-height: 1.5;
  color: #b9bdd0;
}
.telemetry-consent__actions {
  display: flex;
  gap: 18px;
  margin-top: 6px;
}
.telemetry-consent__btn {
  /* M-TIZEN-11: was `font: 600 24px/1` — 28px secondary rung on pills. */
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-weight: 600;
  font-size: var(--text-sm);
  line-height: 1;
  padding: 16px 34px;
  border-radius: 12px;
  border: 1px solid transparent;
  cursor: pointer;
}
.telemetry-consent__btn--yes {
  background: #f5a524;
  color: #07070d;
}
.telemetry-consent__btn--no {
  background: transparent;
  color: #efece4;
  border-color: rgba(239, 236, 228, 0.35);
}
/*
 * M3 (review tizen__gameux): these buttons shipped NO focus rule — the
 * one-time privacy choice was operated against the Chromium-100-era UA
 * default ring (a faint 1-2px glow at 2-3% screen height, effectively
 * invisible at couch distance on this translucent card). Every other host
 * control defines a :focus-visible ring; the pair now follows the QuickConnect
 * exit-row vocabulary (amber fill takes the light ring, the ghost takes the
 * accent ring). The plain `:focus` arm is the runtime-floor fallback —
 * `:focus-visible` is Chrome 86 while the declared floor is Chromium 85
 * (docs/runtime-floor.md); on ≥86 engines focus-from-click does not occur on
 * a pointerless TV, so the same ring is the right answer on both arms.
 */
.telemetry-consent__btn:focus,
.telemetry-consent__btn:focus-visible {
  outline: 4px solid #efece4;
  outline-offset: 3px;
}
.telemetry-consent__btn--no:focus,
.telemetry-consent__btn--no:focus-visible {
  outline-color: #f5a524;
}
</style>
