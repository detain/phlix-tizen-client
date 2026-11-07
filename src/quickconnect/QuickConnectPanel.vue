<script setup lang="ts">
/**
 * QuickConnectPanel — the TV's pairing-code sign-in surface (S520 / AD-25).
 *
 * A no-keyboard device should never make you type a password on a remote. When
 * the app has a server base chosen but NO session yet, this always-mounted root
 * app offers a CHOICE: sign in with your password (the ordinary ui Connect
 * form, one control away), or sign in with a short code typed on another
 * signed-in Phlix device — the TV polls, then lands the returned token pair
 * through the app's EXISTING `useAuthStore().setTokens` seam (no second store,
 * no QR).
 *
 * CHOOSER-FIRST (w12: RT-097 — review tizen__casualgamer #1): the takeover used
 * to auto-start the pairing ceremony the moment it arrived, burying the ONLY
 * working sign-in path under a code that nothing in the estate can approve
 * (estate verification 2026-11-08, current tips: ui and mobile carry the
 * quick-connect ROUTE FIXTURES only — no approve UI ships anywhere; the server
 * serves the ceremony, the companion half does not exist yet). Arrival now
 * shows a door, not a wall: "Sign in with password" is the PRIMARY amber
 * action and retires the takeover; "Sign in with a pairing code" is the
 * secondary action, and only after choosing it does any session start. A
 * choose-mode panel issues ZERO requests — the initiate fetch cannot happen
 * until the code path is picked — and the hint states honestly that no
 * companion app can approve a code yet, so the choice is informed, not a trap.
 *
 * PLACEMENT / SCOPE (honest): mounted as a sibling root app that shares the
 * main app's pinia — the exact pattern every other TV overlay uses — and
 * rendered full-bleed opaque ONLY while `eligible` (server set AND logged out
 * AND still on screen AND not dismissed). The empty-base first-run Connect
 * screen stays owned by `@phlix/ui` (nothing to pair against yet); this surface
 * takes over the instant a base exists but a session does not — AS A CHOOSER —
 * and retires itself the moment `setTokens` makes `isLoggedIn` true, or the
 * viewer picks the password path. It introduces no route and touches no
 * `@phlix/ui` internals.
 *
 * DISMISSIBLE (C16 / tizen__casualgamer — a takeover is a door, never a wall):
 * both modes exit remote-operably. In chooser mode the password pill retires
 * the takeover; in pairing mode the persistent "Enter password instead" control
 * retires it and stops the ceremony, and BACK reaches the same retire through
 * the S526 ladder — the panel registers itself as a closable layer by carrying
 * `data-quick-connect-panel` on its takeover root, the bridge rings an `Escape`
 * keydown bell on it, and THIS component alone decides what closing means
 * (mirroring the generic focus-trap layer's contract exactly). Dismissal is
 * per-base: choosing a DIFFERENT server re-offers the takeover — always back at
 * the chooser. RT-050 (review tizen__casualgamer #2) sharpens the pairing
 * failure copy: an old server that refuses the quick-connect route with an
 * answered 4xx now reads "this server can't do code sign-in yet — use your
 * password" (naming the pill that is already on screen) instead of the
 * network-blaming "could not reach"; genuine no-answer failures keep the
 * unreachable wording.
 *
 * FOCUS-SAFE (S512 containment doctrine, honored): this never calls `focus()`
 * and never grabs focus on mount — the takeover is never a trap; its controls
 * (the chooser's two pills; in pairing mode the always-present dismiss button,
 * plus "Try again" in the non-fatal terminal phases) are plain focusable nodes
 * a D-pad walk reaches, and BACK escapes the surface even while focus sits
 * invisibly beneath it. C2 (review tizen__gameux) closes the other half of that
 * sentence: carrying `data-spatial-takeover` makes the candidate watcher
 * (src/spatial/focusCandidates.ts) treat this subtree as the ONLY spatial
 * region while it is mounted — hidden controls beneath are swept from the pool
 * and a focus parked under the panel is released, so the D-pad can neither land
 * on nor fire an unseen action. It issues no request while hidden, dismissed,
 * or still in choose mode (`isVisible` folds in `document` visibility, the
 * mount, auth and dismissal state; a session exists only in pairing mode), so
 * a backgrounded, logged-in or retired TV polls zero times.
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
import { sanitizeServerAddress, pushAddressHistory } from '../resolveConfig';
import { tTizen } from '../i18n/tizen';

const apiBase = useApiBase();
const auth = useAuthStore();

const mounted = ref(false);
const onScreen = ref(true);
const dismissed = ref(false);
/**
 * RT-097: the takeover arrives in `choose` mode — a two-path sign-in chooser
 * that requests nothing. Only the explicit code choice flips it to `pairing`,
 * which is what arms (and disarms) the ceremony session.
 */
const mode = ref<'choose' | 'pairing'>('choose');
const code = ref('');
const expiresAtSeconds = ref<number | null>(null);
const phase = ref<PairingPhase | null>(null);

let session: PairingSession | null = null;

/** Show the takeover when there is a server to pair against, no session yet,
 * and the viewer has not retired it for THIS base (C16). */
const eligible = computed(
  () => mounted.value && Boolean(apiBase.value) && !auth.isLoggedIn && !dismissed.value
);

/** The ceremony runs ONLY in pairing mode: the watcher below is the single
 * seam that can start or stop a session (RT-097 — arrival alone never
 * initiates). */
const pairingActive = computed(() => eligible.value && mode.value === 'pairing');

/** Terminal-but-recoverable states that offer a fresh attempt rather than a dead end.
 *  RT-050: `unsupported` is deliberately ABSENT — re-initiating against the same
 *  old server cannot change its answer; that copy routes to the password pill,
 *  which is permanently mounted below. */
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
    case 'unsupported':
      return tTizen('quickConnect.unsupported');
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
    isVisible: () =>
      mounted.value && onScreen.value && !auth.isLoggedIn && !dismissed.value && mode.value === 'pairing',
    applyTokens: (tokens) => {
      // The existing auth seam is the ONLY token store; the base we paired
      // against is already the app's server, mirrored back idempotently.
      auth.setTokens(tokens.accessToken, tokens.refreshToken);
      // RT-056 (review tizen__secnet #1): the mirror is a WRITE to
      // `phlix.serverUrl` — the exact slot the M-TIZEN-07 storage gate was
      // built for. Pre-cure it wrote apiBase raw, so a `javascript:`/`data:`
      // base (hand-edited storage feeding a stale pairing, a poisoned future
      // suggestion) persisted forever and re-seeded the next cold boot. The
      // pair itself is a real credential the server minted — setTokens above
      // stays unconditional; only the ADDRESS mirror is gated, through the
      // same sanitizeServerAddress + pushAddressHistory edge the Connect
      // writers use, so the paired base also becomes a re-seed candidate.
      try {
        const address = sanitizeServerAddress(apiBase.value);
        if (address === null) {
          console.warn('[phlix] quick-connect: refusing to mirror an unsafe base to storage', apiBase.value);
        } else {
          globalThis.localStorage.setItem('phlix.serverUrl', address);
          pushAddressHistory(globalThis.localStorage, address);
        }
      } catch {
        // Persistence is best-effort — setTokens already landed the session.
      }
    },
    onCode: (next, exp, owner) => {
      // RT-055 (review tizen__exploiter #4): only the session this panel
      // currently holds may stamp the displayed code. A superseded session
      // (re-base, dismiss-then-reoffer) whose initiate answer lands late is
      // dropped here — the code on screen always belongs to the live poller.
      if (owner !== session) return;
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
 * form the opaque panel was covering (C16). The pairingActive watcher does the
 * session teardown; this only flips the per-base dismissal decision. Serves
 * BOTH modes: the chooser's primary pill and the pairing card's escape. */
function dismiss(): void {
  dismissed.value = true;
}

/** RT-097: the code path is a CHOSEN path — only this click arms the
 * ceremony; nothing before it has touched the network. */
function startPairing(): void {
  mode.value = 'pairing';
}

onMounted(() => {
  mounted.value = true;
  onScreen.value = document.visibilityState !== 'hidden';
  document.addEventListener('visibilitychange', onVisibilityChange);
  // Pairing start is driven SOLELY by the `pairingActive` watcher: arrival
  // lands in choose mode, where the computed stays false and ZERO requests
  // happen (RT-097). An eager `beginSession()` here — or on `eligible` — would
  // re-create the auto-takeover this cure removes.
});

onBeforeUnmount(() => {
  mounted.value = false;
  document.removeEventListener('visibilitychange', onVisibilityChange);
  endSession();
});

// Dismissal retires the takeover FOR THE BASE IT WAS MADE AGAINST: choosing a
// different server is a fresh sign-in opportunity, so a new base re-offers the
// takeover — always back at the chooser (RT-097: a re-offer never presumes the
// viewer wanted the code path just because they tried it on the old base).
watch(apiBase, () => {
  dismissed.value = false;
  mode.value = 'choose';
});

// A base arriving (Connect commit) or the session dropping (logout) shows or
// retires the takeover; choosing the code path (or a fresh login / dismissal
// ending it) starts or stops the ceremony. This watcher is the session's ONLY
// starter — the chooser cannot fire it by accident.
watch(pairingActive, (active) => {
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
    data-spatial-takeover
    :aria-label="tTizen('quickConnect.aria')"
    @keydown.escape="dismiss"
  >
    <div class="quick-connect__card">
      <p class="quick-connect__eyebrow">
        {{ tTizen('quickConnect.eyebrow') }}
      </p>

      <!-- RT-097 chooser mode: the two sign-in paths, honest about what each
           can do TODAY. Password is the PRIMARY pill (it works against every
           server that has one); the code path is secondary precisely because
           its companion half does not ship yet. Reusing the pairing card's
           two button roles: __retry is the amber primary, __dismiss the ghost
           secondary — one row, D-pad reachable, no new visual language. -->
      <template v-if="mode === 'choose'">
        <h1 class="quick-connect__title">
          {{ tTizen('quickConnect.chooseTitle') }}
        </h1>
        <p class="quick-connect__lead">
          {{ tTizen('quickConnect.chooseLead') }}
        </p>

        <div class="quick-connect__actions">
          <button
            type="button"
            class="quick-connect__retry"
            data-testid="qc-choose-password"
            @click="dismiss"
          >
            {{ tTizen('quickConnect.choosePassword') }}
          </button>

          <button
            type="button"
            class="quick-connect__dismiss"
            data-testid="qc-choose-code"
            @click="startPairing"
          >
            {{ tTizen('quickConnect.chooseCode') }}
          </button>
        </div>

        <p class="quick-connect__hint">
          {{ tTizen('quickConnect.hint') }}
        </p>
      </template>

      <template v-else>
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
      </template>
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
  /* C3 (review tizen__crossfe): pair the Chrome-87 `inset` shorthand with the
   * four longhands so the takeover still covers the viewport on the declared
   * Chromium-85 floor, where the shorthand is dropped silently. */
  inset: 0;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
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
  font-size: var(--text-xs); /* M-TIZEN-11: was 22px */
  letter-spacing: 0.42em;
  text-transform: uppercase;
  color: #8f94a8;
}
.quick-connect__title {
  margin: 0;
  font-size: var(--text-xl); /* M-TIZEN-11: was 44px */
  font-weight: 700;
  letter-spacing: 0.01em;
}
.quick-connect__lead {
  margin: 0;
  font-size: var(--text-base); /* M-TIZEN-11: was 26px */
  color: #c8ccd8;
}
.quick-connect__code {
  margin: 8px 0;
  padding: 26px 44px;
  font-size: var(--text-4xl); /* M-TIZEN-11: was 104px */
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
  font-size: var(--text-sm); /* M-TIZEN-11: was 20px */
  color: #8f94a8;
}
.quick-connect__retry {
  margin-top: 6px;
  padding: 16px 40px;
  font-size: var(--text-sm); /* M-TIZEN-11: was 24px */
  font-weight: 600;
  color: #07070d;
  background: #f5a524;
  border: none;
  border-radius: 999px;
  cursor: pointer;
}
.quick-connect__retry:focus-visible {
  outline: 4px solid #efece4;
  outline-offset: 3px;
}
/* C16 exit row: the amber CTA stays the pairing focal action; the persistent
 * "Enter password instead" escape is a ghost pill — reachable, legible, never
 * competing. Both live on one flex row so terminal phases sit side by side.
 * RT-097 reuses the pair of roles in the chooser: amber = the path that works
 * today (password), ghost = the optional pairing-code path. */
.quick-connect__actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
}
.quick-connect__dismiss {
  padding: 16px 40px;
  font-size: var(--text-sm); /* M-TIZEN-11: was 24px */
  font-weight: 600;
  color: #efece4;
  background: transparent;
  border: 1px solid rgba(239, 236, 228, 0.4);
  border-radius: 999px;
  cursor: pointer;
}
.quick-connect__dismiss:focus-visible {
  outline: 4px solid #f5a524;
  outline-offset: 3px;
}
</style>
