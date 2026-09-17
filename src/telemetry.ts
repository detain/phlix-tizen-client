/**
 * AD-27 client telemetry — the OPT-IN consent gate + the single bounded
 * heartbeat sender. Tizen lane S521.
 *
 * Honest posture (survey-c / CONCURRENCY AD-27 "tier 3"): telemetry is OFF by
 * default. Nothing is ever sent until the user explicitly consents, and a
 * withdrawal stops the sender immediately. This module owns the WHOLE privacy
 * surface so the UI can only read/write a boolean and start/stop — the request
 * itself and its (bounded) shape live here and nowhere else.
 *
 * The wire: exactly ONE existing server route —
 *   `POST /api/v1/telemetry/heartbeat`
 * (the S518 consent-first route, live at server era 730e55b7 and present in the
 * vendored 410-tuple manifest). We add no route, so the fixture stays
 * byte-identical and no contracts cascade fires. The server 400s before parsing
 * unless `consent === true`; we never even reach the network when unconsented,
 * and the handler `record()` never throws → the client treats any non-2xx as a
 * swallow-and-retry-later, never an error path.
 *
 * The payload is the server's BOUNDED field set only — a device id (from the
 * EXISTING `deviceId.ts` seam, so there is no second install identity), the
 * client type/platform, and the shipped build version. ZERO PII: no titles, no
 * account, no free text. We deliberately do NOT reuse `@phlix/contracts`'
 * server→hub `HeartbeatDto` (that is a different, richer registry the survey
 * forbids borrowing).
 *
 * Cadence (survey-c): a coarse hourly timer wakes the tick, but a heartbeat is
 * actually SENT at most once per 24 h (a persisted last-sent stamp throttles the
 * rest). Failures are swallowed on the spot and simply leave the stamp
 * untouched, so the next hourly tick retries — the app is never blocked or
 * surfaced-to by telemetry.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { ApiClient } from '@phlix/ui';
import { resolveDeviceId } from './deviceId';

/** localStorage slot holding the consent decision. Unset ⇒ OFF (never pre-checked). */
export const CONSENT_KEY = 'phlix.telemetry.consent';
/** localStorage slot holding the UNIX-ms stamp of the last SUCCESSFUL heartbeat. */
export const LAST_SENT_KEY = 'phlix.telemetry.lastSentAt';

/** Shipped client build version, mirrored from package.json. Pinned by test. */
export const CLIENT_VERSION = '1.0.0';

/** Coarse wake cadence for the throttle check (survey-c: "hourly tick"). */
export const HEARTBEAT_TICK_MS = 60 * 60 * 1000;
/** Minimum spacing between two actual sends (survey-c: "24h throttle"). */
export const HEARTBEAT_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** The device-type the server pattern-checks for a Samsung TV. */
const CLIENT_TYPE = 'samsung-tizen';
const PLATFORM = 'tizen';

/**
 * The minimal transport surface the heartbeat needs. Declaring it structurally
 * (rather than importing ApiClient's class shape) keeps the sender unit-testable
 * with a bare fake, and matches how `quickConnectClient.ts` treats its transport.
 * The literal request site below names its receiver `client` on purpose — the
 * `routeManifest.gate` scanner recognises `client.post('…')` and pins the tuple.
 */
export interface HeartbeatTransport {
  post<T = unknown>(endpoint: string, data?: unknown): Promise<T>;
}

/** The bounded, zero-PII heartbeat body — the server's pattern-checked field set. */
export interface TelemetryHeartbeatPayload {
  instance_id: string;
  version: string;
  client_type: string;
  platform: string;
  build: string;
}

type ConsentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Read the consent flag. STRICTLY `=== 'true'`: unset, empty, garbage, or a
 * prior "false" all mean OFF. The default is OFF by construction — there is no
 * code path that turns telemetry on without an explicit stored `true`.
 */
export function getConsent(storage: ConsentStorage): boolean {
  return storage.getItem(CONSENT_KEY) === 'true';
}

/**
 * Persist a consent decision. `true` stores the opt-in flag; `false` stores an
 * explicit decline (so the one-time prompt never re-appears), and the last-sent
 * stamp is CLEARED on decline — a re-consent later must not inherit an old
 * throttle window, and a declining device retains no send history locally.
 */
export function setConsent(storage: ConsentStorage, granted: boolean): void {
  storage.setItem(CONSENT_KEY, granted ? 'true' : 'false');
  if (!granted) storage.removeItem(LAST_SENT_KEY);
}

/** Build the bounded payload from the install-stable device id. No PII added. */
export function buildHeartbeatPayload(instanceId: string): TelemetryHeartbeatPayload {
  return {
    instance_id: instanceId,
    version: CLIENT_VERSION,
    client_type: CLIENT_TYPE,
    platform: PLATFORM,
    build: CLIENT_VERSION,
  };
}

/**
 * The single request site. Kept isolated so the cadence/throttle/consent logic
 * above stays pure and the one HTTP literal stays tuple-exact under the gate.
 */
async function postHeartbeat(
  client: HeartbeatTransport,
  payload: TelemetryHeartbeatPayload,
): Promise<void> {
  await client.post('/api/v1/telemetry/heartbeat', payload);
}

export interface TelemetryDeps {
  transport: HeartbeatTransport;
  storage: ConsentStorage;
  /** Inject for determinism (tests pass a fake clock). */
  now: () => number;
  /** Inject for determinism (tests pass a fake scheduler returning a clear fn). */
  schedule: (fn: () => void, ms: number) => () => void;
  /** Inject for determinism (the stable install device id). */
  instanceId: string;
}

export interface TelemetryHandle {
  /** One throttled attempt: no-ops unless consented AND the 24h window elapsed. */
  tick: () => Promise<void>;
  /** Arm the coarse hourly timer (idempotent). */
  start: () => void;
  /** Tear the timer down (idempotent). */
  stop: () => void;
}

/**
 * Create a guarded heartbeat sender. Nothing runs until `start()`; `tick` is the
 * single decision point and is fully guarded — consent false ⇒ zero transport
 * calls, within the 24h throttle ⇒ zero calls, and any transport failure is
 * swallowed (the last-sent stamp stays put so the next tick retries). `start()`
 * arms the hourly timer only; the first send therefore happens on the first tick
 * AFTER a boot/enable, never synchronously at start-up.
 */
export function createHeartbeat(deps: TelemetryDeps): TelemetryHandle {
  let cancel: (() => void) | null = null;
  let stopped = false;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    if (!getConsent(deps.storage)) return; // consent is the outermost gate.

    const rawLast = deps.storage.getItem(LAST_SENT_KEY);
    const last = rawLast === null ? 0 : Number(rawLast);
    if (Number.isFinite(last) && deps.now() - last < HEARTBEAT_MIN_INTERVAL_MS) {
      return; // throttled — nothing this tick.
    }

    try {
      await postHeartbeat(deps.transport, buildHeartbeatPayload(deps.instanceId));
      // Only a SUCCESS advances the throttle window; a failure leaves it alone so
      // the next hourly tick retries. Swallowed by design.
      deps.storage.setItem(LAST_SENT_KEY, String(deps.now()));
    } catch {
      // Every failure swallowed: telemetry must never surface in the app.
    }
  };

  return {
    tick,
    start() {
      if (cancel || stopped) return; // already armed, or stopped for good.
      cancel = deps.schedule(() => {
        void tick();
      }, HEARTBEAT_TICK_MS);
    },
    stop() {
      stopped = true;
      cancel?.();
      cancel = null;
    },
  };
}

let controller: TelemetryHandle | null = null;

/**
 * Boot/UI entry point: start the hourly heartbeat timer IF consent is on.
 * Idempotent — a second call while running is a no-op, so there is exactly one
 * sender across the app. It is always safe to call: a stopped handle whose tick
 * re-checks consent means a not-yet-consented boot simply never sends.
 */
export function startTelemetry(deps: TelemetryDeps): TelemetryHandle {
  if (controller) return controller;
  controller = createHeartbeat(deps);
  controller.start();
  return controller;
}

/** Withdraw: stop the running sender (if any) and clear the module singleton. */
export function stopTelemetry(): void {
  controller?.stop();
  controller = null;
}

/** Test seam: drop the singleton between cases. Not used by the app. */
export function __resetTelemetryForTests(): void {
  controller = null;
}

/**
 * Resolve a transport for the app's current server base. Public endpoints (the
 * heartbeat is keyed by `instance_id`, not a session) — so no token store is
 * attached, and this introduces no new trust boundary.
 */
export function createHeartbeatTransport(baseUrl: string, fetchImpl?: typeof fetch): HeartbeatTransport {
  return new ApiClient({ baseUrl, fetchImpl }) as unknown as HeartbeatTransport;
}

/** Re-export the device-id seam so callers get a stable install identity with no second store. */
export { resolveDeviceId };

/**
 * Assemble production deps (real clock, `setInterval` scheduler, the install-stable
 * device id, a public transport for the current base) so boot and the consent card
 * start the sender identically. The scheduler returns a `clearInterval` teardown.
 */
export function buildTelemetryDeps(input: {
  storage: ConsentStorage;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): TelemetryDeps {
  return {
    transport: createHeartbeatTransport(input.baseUrl, input.fetchImpl),
    storage: input.storage,
    now: () => Date.now(),
    schedule: (fn, ms) => {
      const id = setInterval(fn, ms);
      return () => clearInterval(id);
    },
    instanceId: resolveDeviceId(input.storage),
  };
}
