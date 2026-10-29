<script setup lang="ts">
/**
 * QuickConnectPanel — the TV's password-free pairing surface (S520 / AD-25).
 *
 * A no-keyboard device should never make you type a password on a remote. When
 * the app has a server base chosen but NO session yet, this always-mounted root
 * app shows a short code; you type THAT on your phone/companion, and the TV
 * polls, then lands the returned token pair through the app's EXISTING
 * `useAuthStore().setTokens` seam (no second store, no QR). The companion's
 * approve action is deliberately out of scope here — this is the TV half only.
 *
 * PLACEMENT / SCOPE (honest): mounted as a sibling root app that shares the main
 * app's pinia — the exact pattern every other TV overlay uses — and rendered
 * full-bleed opaque ONLY while `eligible` (server set AND logged out AND still on
 * screen AND not dismissed). The empty-base first-run Connect screen stays owned
 * by `@phlix/ui` (nothing to pair against yet); this surface takes over the
 * instant a base exists but a session does not, and retires itself the moment
 * `setTokens` makes `isLoggedIn` true. It introduces no route and touches no
 * `@phlix/ui` internals.
 *
 * DISMISSIBLE (C16 / tizen__casualgamer — a takeover is a door, never a wall):
 * the ceremony's companion half is not shippable yet (no estate client approves
 * a code), so the takeover must never bury the ONLY login path beneath it. Two
 * exits, both remote-operable: a persistent "Enter password instead" control
 * retires the panel and stops the ceremony, and BACK reaches the same retire
 * through the S526 ladder — the panel registers itself as a closable layer by
 * carrying `data-quick-connect-panel` on its takeover root, the bridge rings an
 * `Escape` keydown bell on it, and THIS component alone decides what closing
 * means (mirroring the generic focus-trap layer's contract exactly). Dismissal
 * is per-base: choosing a DIFFERENT server re-offers the pairing code.
 *
 * FOCUS-SAFE (S512 containment doctrine, honored): this never calls `focus()`
 * and never grabs focus on mount — the takeover is never a trap; its controls
 * (the always-present dismiss button, plus "Try again" in the non-fatal terminal
 * phases) are plain focusable nodes a D-pad walk reaches, and BACK escapes the
 * surface even while focus sits invisibly beneath it. It issues no request while
 * hidden or dismissed (`isVisible` folds in `document` visibility + the mount,
 * auth and dismissal state), so a backgrounded, logged-in or retired TV polls
 * zero times.
 *
 * @category TV-Specific Component
 * @duplicate No phlix-ui equivalent — @phlix/ui's Connect screen picks a server;
 * quick-connect pairs a device to one WITHOUT a password, which is TV-native.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ApiClient, useApiBase, useAuthStore } from '@phlix/ui';
import { createPairingSession, type PairingPhase, type PairingSession } from './quickConnectSession';
import { tTizen } from '../i18n/tizen';

const apiBase = useApiBase();
const auth = useAuthStore();

const mounted = ref(false);
const onScreen = ref(true);
const dismissed = ref(false);
const code = ref('');
const expiresAtSeconds = ref<number | null>(null);
const phase = ref<PairingPhase | null>(null);

let session: PairingSession | null = null;

/** Show + poll only when there is a server to pair against, no session yet,
 * and the viewer has not retired the takeover for THIS base (C16). */
const eligible = computed(
  () => mounted.value && Boolean(apiBase.value) && !auth.isLoggedIn && !dismissed.value
);

/** Terminal-but-recoverable states that offer a fresh attempt rather than a dead end. */
const retryable = computed(() => phase.value === 'denied' || phase.value === 'expired' || phase.value === 'error');

function currentStatusText(): string {
  switch (phase.value) {
    case 'initiating':
      return tTizen('quickConnect.preparing');
    case 'pairing':
      return tTizen('quickConnect.instruction');
    case 'denied':
      return tTizen('quickConnect.declined');
    case 'expired':
      return tTizen('quickConnect.expired');
    case 'error':
      return tTizen('quickConnect.unreachable');
    default:
      return '';
  }
}

function endSession(): void {
  session?.stop();
  session = null;
}

function beginSession(): void {
  endSession();
  code.value = '';
  expiresAtSeconds.value = null;
  phase.value = 'initiating';
  const client = new ApiClient({ baseUrl: apiBase.value });
  session = createPairingSession({
    client,
    identity: { deviceName: 'Phlix for Samsung TV', deviceType: 'samsung-tizen' },
    isVisible: () => mounted.value && onScreen.value && !auth.isLoggedIn && !dismissed.value,
    applyTokens: (tokens) => {
      // The existing auth seam is the ONLY token store; the base we paired
      // against is already the app's server, mirrored back idempotently.
      auth.setTokens(tokens.accessToken, tokens.refreshToken);
      try {
        globalThis.localStorage.setItem('phlix.serverUrl', apiBase.value);
      } catch {
        // Persistence is best-effort — setTokens already landed the session.
      }
    },
    onCode: (next, exp) => {
      code.value = next;
      expiresAtSeconds.value = exp;
    },
    onStatusChange: (next) => {
      phase.value = next;
    },
  });
  void session.run();
}

function onVisibilityChange(): void {
  onScreen.value = document.visibilityState !== 'hidden';
}

/** Retire the takeover and stop the ceremony — exposes the password sign-in
 * form the opaque panel was covering (C16). The eligible watcher does the
 * session teardown; this only flips the per-base dismissal decision. */
function dismiss(): void {
  dismissed.value = true;
}

onMounted(() => {
  mounted.value = true;
  onScreen.value = document.visibilityState !== 'hidden';
  document.addEventListener('visibilitychange', onVisibilityChange);
  // Pairing start is driven SOLELY by the `eligible` watcher: setting
  // `mounted` here flips the computed false→true and the watcher begins exactly
  // one session. An eager `beginSession()` here would double-start (once now,
  // once on the watcher flush), firing a redundant initiate.
});

onBeforeUnmount(() => {
  mounted.value = false;
  document.removeEventListener('visibilitychange', onVisibilityChange);
  endSession();
});

// Dismissal retires the panel FOR THE BASE IT WAS MADE AGAINST: choosing a
// different server is a fresh pairing opportunity, so a new base re-offers the
// code and the eligible watcher below starts exactly one session as at birth.
watch(apiBase, () => {
  dismissed.value = false;
});

// A base arriving (Connect commit) or the session dropping (logout) starts or
// stops pairing without a remount; a fresh login (eligible → false) tears it down.
watch(eligible, (active) => {
  if (active) beginSession();
  else endSession();
});
</script>

<template>
  <div
    v-if="eligible"
    class="quick-connect"
    role="dialog"
    aria-live="polite"
    data-quick-connect-panel
    :aria-label="tTizen('quickConnect.aria')"
    @keydown.escape="dismiss"
  >
    <div class="quick-connect__card">
      <p class="quick-connect__eyebrow">
        {{ tTizen('quickConnect.eyebrow') }}
      </p>
      <h1 class="quick-connect__title">
        {{ tTizen('quickConnect.title') }}
      </h1>
      <p class="quick-connect__lead">
        {{ currentStatusText() }}
      </p>

      <p
        v-if="code"
        class="quick-connect__code"
        data-testid="qc-code"
      >
        {{ code }}
      </p>
      <p
        v-else
        class="quick-connect__code quick-connect__code--empty"
        aria-hidden="true"
      >
        ••••
      </p>

      <p
        v-if="expiresAtSeconds"
        class="quick-connect__meta"
      >
        {{ tTizen('quickConnect.expiryNote') }}
      </p>

      <div class="quick-connect__actions">
        <button
          v-if="retryable"
          type="button"
          class="quick-connect__retry"
          data-testid="qc-retry"
          @click="beginSession"
        >
          {{ tTizen('quickConnect.tryAgain') }}
        </button>

        <button
          type="button"
          class="quick-connect__dismiss"
          data-testid="qc-dismiss"
          @click="dismiss"
        >
          {{ tTizen('quickConnect.usePassword') }}
        </button>
      </div>

      <p class="quick-connect__hint">
        {{ tTizen('quickConnect.hint') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
/*
 * Nocturne atmosphere (matches the S515 boot splash field so a hand-off from
 * splash → pairing is one continuous dark surface, never a white flash). The
 * short code is the single focal object: a large, letter-spaced, tabular figure
 * you can read across a living room, framed by one amber rule. No external
 * webfonts — the .wgt runs offline under a `style-src 'self'` CSP, so the
 * display weight comes from the system sans at scale + tracking.
 */
.quick-connect {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(120% 90% at 50% 38%, #0d0e1a 0%, #07070d 60%, #040407 100%),
    #07070d;
  color: #efece4;
  z-index: 12000;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.quick-connect__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 22px;
  padding: 64px 88px;
  max-width: 1100px;
}
.quick-connect__eyebrow {
  margin: 0;
  font-size: 22px;
  letter-spacing: 0.42em;
  text-transform: uppercase;
  color: #8f94a8;
}
.quick-connect__title {
  margin: 0;
  font-size: 44px;
  font-weight: 700;
  letter-spacing: 0.01em;
}
.quick-connect__lead {
  margin: 0;
  font-size: 26px;
  color: #c8ccd8;
}
.quick-connect__code {
  margin: 8px 0;
  padding: 26px 44px;
  font-size: 104px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.16em;
  font-variant-numeric: tabular-nums;
  border-radius: 22px;
  background: rgba(245, 165, 36, 0.06);
  border: 1px solid rgba(245, 165, 36, 0.34);
  box-shadow: 0 24px 70px -30px rgba(0, 0, 0, 0.8);
}
.quick-connect__code--empty {
  color: #3a3f55;
}
.quick-connect__meta,
.quick-connect__hint {
  margin: 0;
  font-size: 20px;
  color: #8f94a8;
}
.quick-connect__retry {
  margin-top: 6px;
  padding: 16px 40px;
  font-size: 24px;
  font-weight: 600;
  color: #07070d;
  background: #f5a524;
  border: none;
  border-radius: 999px;
  cursor: pointer;
}
.quick-connect__retry:focus-visible {
  outline: 3px solid #efece4;
  outline-offset: 3px;
}
/* C16 exit row: the amber CTA stays the pairing focal action; the persistent
 * "Enter password instead" escape is a ghost pill — reachable, legible, never
 * competing. Both live on one flex row so terminal phases sit side by side. */
.quick-connect__actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
}
.quick-connect__dismiss {
  padding: 16px 40px;
  font-size: 24px;
  font-weight: 600;
  color: #efece4;
  background: transparent;
  border: 1px solid rgba(239, 236, 228, 0.4);
  border-radius: 999px;
  cursor: pointer;
}
.quick-connect__dismiss:focus-visible {
  outline: 3px solid #f5a524;
  outline-offset: 3px;
}
</style>
