/**
 * S520 — Quick-Connect pairing session orchestrator (TV / client half).
 *
 * Drives ONE pairing attempt end to end on the TV: initiate → surface the short
 * code → poll status ONLY while the pairing surface is visible → on approval
 * redeem the token pair → hand `{accessToken, refreshToken}` to the app's
 * EXISTING auth/token-store seam. It owns timing + lifecycle + error posture;
 * it owns no HTTP (see {@link ./quickConnectClient}) and no token storage — the
 * `applyTokens` seam is the caller's `useAuthStore().setTokens`, so this module
 * can never spin up a second store.
 *
 * Honest non-fatal posture: `denied`, `expired` and `abandoned` (the surface
 * went away) are terminal-but-calm — `run()` RESOLVES with that phase, it never
 * throws and never nukes the app; a retry is simply a fresh session. Only an
 * unrecoverable network budget (`error`) or a success body we cannot read also
 * resolve — again without throwing. The pairing surface shows a retry affordance
 * off the phase; nothing here blocks the rest of the TV app.
 *
 * Never hammers: the cadence prefers an explicit override, then the
 * server-published `interval`, then a conservative default; transient network
 * faults back off exponentially against a ceiling, and while the surface is
 * HIDDEN the loop sleeps WITHOUT touching the network at all (the pin: an
 * invisible pairing screen issues zero status requests).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  fetchPairingStatus,
  initiatePairing,
  redeemPairingToken,
  type PairingTransport,
  type RedeemedTokens,
} from './quickConnectClient';

/** The lifecycle phases the pairing surface renders off. */
export type PairingPhase =
  | 'initiating'
  | 'pairing'
  | 'approved'
  | 'denied'
  | 'expired'
  | 'abandoned'
  | 'error';

/** Phases after which `run()` has stopped and will not poll again. */
const TERMINAL_PHASES: ReadonlySet<PairingPhase> = new Set<PairingPhase>([
  'approved',
  'denied',
  'expired',
  'abandoned',
  'error',
]);

/** How often a HIDDEN surface re-checks visibility (never a status request). */
const HIDDEN_RECHECK_MS = 1_000;

/** Ceiling for transient-error backoff, so a long outage stops at a slow trickle. */
const MAX_BACKOFF_MS = 60_000;

/**
 * M-TIZEN-25 (review tizen__exploiter): the poll cadence is SERVER-CONTROLLED
 * (`offer.intervalSeconds`), and the pre-cure code multiplied it into
 * `sleep()` unclamped — a malicious or merely misconfigured server answering
 * `0` (or negative) turned the pairing loop into a tight fetch storm
 * (`backoffMs` on a zero base is still zero). The allow-list: floor 1000 ms
 * (no server needs a sub-second status ping; excess polling is the attack),
 * ceiling 60 000 ms (the same slow-trickle contract the error backoff honors
 * — a server asking for minutes-long polls waits AT MOST a minute here, which
 * only ever delays pairing completion, never harms). Out-of-range values are
 * clamped, not rejected: the server stays authoritative inside its sandbox.
 */
const MIN_POLL_MS = 1_000;
const MAX_POLL_MS = 60_000;

function clampPollMs(rawSeconds: number): number {
  if (!Number.isFinite(rawSeconds)) return DEFAULT_POLL_INTERVAL_SECONDS * 1_000;
  const ms = rawSeconds * 1_000;
  return Math.min(Math.max(ms, MIN_POLL_MS), MAX_POLL_MS);
}

/** Consecutive network faults tolerated before the attempt is called dead. */
const MAX_CONSECUTIVE_NETWORK_ERRORS = 6;

export interface PairingSessionDeps {
  /** HTTP transport (the real `@phlix/ui` ApiClient in prod; a fake in tests). */
  client: PairingTransport;
  /** Advisory device identity sent on initiate. */
  identity: { deviceName: string; deviceType: string };
  /** Gate: only when true may a status request be issued. */
  isVisible: () => boolean;
  /** The EXISTING token-store seam — the caller wires `useAuthStore().setTokens`. */
  applyTokens: (tokens: RedeemedTokens) => void;
  /** Surface the short code (+ optional absolute expiry, unix seconds). */
  onCode: (code: string, expiresAtSeconds: number | null) => void;
  /** Observe every phase transition (for the on-screen caption). */
  onStatusChange?: (phase: PairingPhase) => void;
  /** Injectable sleeper so tests drive time without fake timers. */
  sleep?: (ms: number) => Promise<void>;
  /** Force a cadence, ignoring any server-published interval (tests / tuning). */
  intervalSeconds?: number;
}

export interface PairingSession {
  /** Run the pairing flow to a terminal phase. Resolves with that phase. */
  run: () => Promise<PairingPhase>;
  /** Abandon (surface navigated away / unmounted). Idempotent. */
  stop: () => void;
  /** True once a terminal phase has been reached or `stop()` was called. */
  isFinished: () => boolean;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Exponential backoff against a ceiling, keyed by the 1-based error count. */
function backoffMs(baseMs: number, consecutiveErrors: number): number {
  const grown = baseMs * 2 ** (consecutiveErrors - 1);
  return Math.min(grown, MAX_BACKOFF_MS);
}

/**
 * Build a single pairing session. The returned `run()` is cancellable via
 * `stop()` at the next await boundary; a second `run()` on the same handle is a
 * programming error, so a fresh session is created per attempt (retry = rebuild).
 */
export function createPairingSession(deps: PairingSessionDeps): PairingSession {
  const sleep = deps.sleep ?? defaultSleep;
  const emit = (phase: PairingPhase): void => deps.onStatusChange?.(phase);

  let stopped = false;
  let finished = false;

  const finish = (phase: PairingPhase): PairingPhase => {
    finished = true;
    emit(phase);
    return phase;
  };

  return {
    isFinished: () => finished,

    stop(): void {
      // Idempotent: a stop after a terminal phase changes nothing.
      stopped = true;
    },

    async run(): Promise<PairingPhase> {
      if (finished || stopped) return finish('abandoned');

      emit('initiating');
      let offer;
      try {
        offer = await initiatePairing(deps.client, deps.identity);
      } catch {
        // initiate failed: no code exists to poll; a calm dead-end, retryable.
        return finish('error');
      }
      deps.onCode(offer.code, offer.expiresAtSeconds);
      emit('pairing');

      const baseMs = clampPollMs(
        deps.intervalSeconds ?? offer.intervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS,
      );

      let consecutiveErrors = 0;
      while (!stopped) {
        if (!deps.isVisible()) {
          // Invisible: re-check later WITHOUT issuing any status request.
          await sleep(HIDDEN_RECHECK_MS);
          continue;
        }

        let status;
        try {
          status = await fetchPairingStatus(deps.client, offer.code);
          consecutiveErrors = 0;
        } catch {
          consecutiveErrors += 1;
          if (consecutiveErrors >= MAX_CONSECUTIVE_NETWORK_ERRORS) {
            return finish('error');
          }
          await sleep(backoffMs(baseMs, consecutiveErrors));
          continue;
        }

        if (status === 'approved') {
          let tokens;
          try {
            tokens = await redeemPairingToken(deps.client, offer.code);
          } catch {
            return finish('error');
          }
          deps.applyTokens(tokens);
          return finish('approved');
        }
        if (status === 'denied') return finish('denied');
        if (status === 'expired') return finish('expired');

        // pending / unknown → hold the cadence and poll again.
        await sleep(baseMs);
      }

      return finish('abandoned');
    },
  };
}

export { TERMINAL_PHASES };
