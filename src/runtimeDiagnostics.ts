/**
 * On-device runtime-failure visibility — review tizen__devops M3.
 *
 * ## The problem this cures
 *
 * Before this module the client had NO capture of uncaught errors at all: a
 * throwing watcher, a broken socket callback, or a rejected promise ended in
 * an invisible `console.error` behind the TV. (The vendored `@phlix/ui`
 * v0.99.10 registers no `app.config.errorHandler` and no window listeners —
 * grep-proven — and `src/telemetry.ts` is the separate S521 OPT-IN
 * heartbeat, not an error path.) There is also NO telemetry backend in the
 * estate: the server route manifest is the frozen contracts fixture, so a
 * "crash uploader" is neither available nor wanted.
 *
 * ## The honest shape: visibility, not reporting
 *
 * This module is PURELY ON-DEVICE. Zero network calls, zero dependencies.
 * Every uncaught failure is summarized to `{kind, message, at}` (no stacks
 * — see the PII note below), appended to a BOUNDED ring persisted through
 * the EXISTING never-throwing storage seam, exactly like the S529 bounded
 * address history in `resolveConfig.ts`. Surfacing lives in `main.ts`:
 * the terminal boot-failure screen shows the last few captured failures,
 * and a TV that hard-dies leaves its cause of death readable on disk after
 * relaunch.
 *
 * Why localStorage and not a Tizen log file: the widget manifest ships
 * exactly `internet` + `tv.inputdevice` privileges (S503 prune; TN-2 law:
 * privileges fold in only with their feature), so `tizen.filesystem` is NOT
 * available — and adding the privilege for diagnostics would violate the
 * repo's own manifest doctrine. The webview's localStorage persists across
 * app launches, which is the persistence the cure needs.
 *
 * PII posture: entries store the error's own message + script location,
 * clipped at FAILURE_MESSAGE_LIMIT. Uncaught messages are engine-generated
 * (`"TypeError: x is undefined"`, `"Script error."`); they do not carry
 * credentials or titles. Stack frames could embed user-entered server URLs,
 * so stacks are deliberately NOT persisted. Nothing leaves the device.
 *
 * ## Old-webview constraints (vite `target: 'chrome100'` lowers SYNTAX only;
 * ## src/polyfills.ts records pre-Chrome-98 webviews still in the field)
 *
 * Only ancient-safe runtime APIs are used here: `addEventListener`, JSON,
 * `Array` index/`slice`, `String`, `Number.isFinite`, `Date#toISOString`.
 * Deliberately AVOIDED: `Array.prototype.at` (Chrome 92),
 * `Object.hasOwn` (93), `structuredClone` (98), and the `ErrorEvent` /
 * `PromiseRejectionEvent` CONSTRUCTORS in handler code — handlers read the
 * event fields defensively with `typeof` checks instead of instanceof, so a
 * plain `Event` carrying the same fields behaves identically (and jsdom
 * tests can synthesize one).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

/** localStorage slot holding the bounded failure ring (JSON array). */
export const DIAGNOSTICS_KEY = 'phlix.runtimeFailures';

/** Hard cap on persisted entries — the ring keeps the NEWEST failures. */
export const MAX_RECORDED_FAILURES = 20;

/** Per-message clamp: bounds the serialized ring well inside any quota. */
export const FAILURE_MESSAGE_LIMIT = 300;

/**
 * Burst suppression: a failure identical (kind+message) to the LAST stored
 * entry inside this window is not rewritten. A per-frame throwing loop can
 * therefore never become a per-frame localStorage write storm; the persisted
 * `at` of the run stays slightly stale during the burst — honest and cheap.
 */
export const DUPLICATE_SUPPRESSION_MS = 1000;

/** The four capture channels; the union is parse-validated on read. */
export type RuntimeFailureKind = 'error' | 'rejection' | 'vue' | 'boot-fatal';

const FAILURE_KINDS: readonly string[] = ['error', 'rejection', 'vue', 'boot-fatal'];

export interface RuntimeFailure {
  kind: RuntimeFailureKind;
  message: string;
  /** UNIX ms of capture (or, for a suppressed burst, of the first occurrence). */
  at: number;
}

/** The minimal storage surface (same shape as `main.ts` `StorageLike`). */
type DiagnosticStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The window surface the capture needs — a real `Window` satisfies it. */
export interface DiagnosticsEventTarget {
  addEventListener(type: string, handler: (event: Event) => void): void;
  removeEventListener(type: string, handler: (event: Event) => void): void;
}

export interface RuntimeFailureDeps {
  storage: DiagnosticStorage;
  /** Injectable for determinism; defaults to the wall clock. */
  now?: () => number;
}

/**
 * Resolve the global `window` if (and only if) it can take listeners.
 * Non-DOM hosts (node tooling, future headless import) get `null` and the
 * install degrades to a recorder with no listeners — never a crash.
 */
export function resolveDiagnosticsWindow(): DiagnosticsEventTarget | null {
  const candidate = globalThis as { window?: Partial<DiagnosticsEventTarget> };
  const win = candidate.window;
  if (win && typeof win.addEventListener === 'function' && typeof win.removeEventListener === 'function') {
    return win as DiagnosticsEventTarget;
  }
  return null;
}

function clip(message: string): string {
  return message.length > FAILURE_MESSAGE_LIMIT ? message.slice(0, FAILURE_MESSAGE_LIMIT) : message;
}

/**
 * Summarize a thrown/rejected value to one honest line. `name: message` for
 * Errors (so "TypeError: ..." survives — the most useful token on the
 * support call), plain strings through, everything else `String()`-coerced.
 * A hostile `toString` is caught; this function must never throw itself.
 */
export function describeThrown(value: unknown): string {
  try {
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    if (typeof value === 'string') return value;
    return String(value);
  } catch {
    return 'unstringable value';
  }
}

/** One-line summary of a window `'error'` event, read DEFENSIVELY (no
 * instanceof — old webviews and jsdom alike just need the fields). */
export function describeWindowErrorEvent(event: Event): string {
  const e = event as Partial<ErrorEvent>;
  const message = typeof e.message === 'string' && e.message ? e.message : 'Uncaught error';
  const file = typeof e.filename === 'string' && e.filename ? e.filename : null;
  const line = typeof e.lineno === 'number' ? e.lineno : null;
  if (!file) return message;
  return line === null ? `${message} @ ${file}` : `${message} @ ${file}:${line}`;
}

function toFailure(raw: unknown): RuntimeFailure | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const entry = raw as Partial<RuntimeFailure>;
  if (typeof entry.message !== 'string') return null;
  if (typeof entry.at !== 'number' || !Number.isFinite(entry.at)) return null;
  const kind = FAILURE_KINDS.includes(entry.kind as string) ? (entry.kind as RuntimeFailureKind) : 'error';
  return { kind, message: clip(entry.message), at: entry.at };
}

/**
 * Read the persisted ring. Parse-don't-validate: missing/corrupt slot, a
 * non-array payload, or malformed entries all degrade SILENTLY to the
 * well-formed subset (or `[]`). A diagnostics reader that throws would be
 * worse than the silence it cures, so storage itself is read in a guard.
 */
export function readRuntimeFailures(storage: DiagnosticStorage): RuntimeFailure[] {
  let raw: string | null = null;
  try {
    raw = storage.getItem(DIAGNOSTICS_KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(toFailure).filter((failure): failure is RuntimeFailure => failure !== null);
  } catch {
    return [];
  }
}

/**
 * Append one failure to the persisted ring. Bounded by
 * `MAX_RECORDED_FAILURES` (oldest evicted) and clamped by
 * `FAILURE_MESSAGE_LIMIT`. Suppression rule: identical kind+message to the
 * LAST stored entry inside `DUPLICATE_SUPPRESSION_MS` writes nothing.
 * NEVER throws — a quota-exceeded or SecurityError storage (the privacy-mode
 * webview that forced T-09's in-memory fallback) simply keeps living in
 * whatever storage the caller resolved.
 */
export function recordRuntimeFailure(deps: RuntimeFailureDeps, failure: { kind: RuntimeFailureKind; message: string }): void {
  const now = deps.now ? deps.now() : Date.now();
  try {
    const ring = readRuntimeFailures(deps.storage);
    const last = ring.length > 0 ? ring[ring.length - 1] : null;
    if (last && last.kind === failure.kind && last.message === clip(failure.message) && now - last.at < DUPLICATE_SUPPRESSION_MS) {
      return; // same burst, suppressed — see DUPLICATE_SUPPRESSION_MS
    }
    ring.push({ kind: failure.kind, message: clip(failure.message), at: now });
    const trimmed = ring.slice(Math.max(0, ring.length - MAX_RECORDED_FAILURES));
    deps.storage.setItem(DIAGNOSTICS_KEY, JSON.stringify(trimmed));
  } catch {
    // Capture must never become the failure. Swallowed by design.
  }
}

export interface RuntimeDiagnosticsHandle {
  /** Record one failure (the Vue bridge in boot() and any future seam). */
  record(failure: { kind: RuntimeFailureKind; message: string }): void;
  /** Remove the window listeners (tests / teardown). Idempotent. */
  dispose(): void;
}

/**
 * Wire the window-level capture: `'error'` (uncaught script errors) and
 * `'unhandledrejection'`. Each handler runs inside its own try/catch — an
 * error listener that throws can surface as a SECOND uncaught error, the
 * recursion this module exists to end. Registers on the resolved target (or
 * degrades to listener-less when there is none, e.g. node); returns the
 * recorder + a teardown. A healthy app never writes: with no failures the
 * storage slot simply does not exist.
 */
export function installRuntimeFailureCapture(deps: RuntimeFailureDeps & { target?: DiagnosticsEventTarget | null }): RuntimeDiagnosticsHandle {
  const storage = deps.storage;
  const now = deps.now ? deps.now : Date.now;
  const record = (failure: { kind: RuntimeFailureKind; message: string }): void => {
    recordRuntimeFailure({ storage, now }, failure);
  };

  const target = deps.target === undefined ? resolveDiagnosticsWindow() : deps.target;
  if (!target) return { record, dispose: () => {} };

  const onError = (event: Event): void => {
    try {
      record({ kind: 'error', message: describeWindowErrorEvent(event) });
    } catch {
      // a capture path that throws is the bug class this whole module is.
    }
  };
  const onRejection = (event: Event): void => {
    try {
      const reason = (event as { reason?: unknown }).reason;
      record({ kind: 'rejection', message: describeThrown(reason) });
    } catch {
      // ditto
    }
  };

  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);

  return {
    record,
    dispose() {
      target.removeEventListener('error', onError);
      target.removeEventListener('unhandledrejection', onRejection);
    },
  };
}

/** UTC `HH:MM:SS` of a stored `at`, or a neutral dash for an unusable stamp. */
export function failureClockText(at: number): string {
  try {
    return new Date(at).toISOString().slice(11, 19);
  } catch {
    return '--:--:--';
  }
}

/** One human line for the boot-failure surface: `[kind] HH:MM:SS message`. */
export function formatRuntimeFailureLine(failure: RuntimeFailure): string {
  return `[${failure.kind}] ${failureClockText(failure.at)} ${failure.message}`;
}
