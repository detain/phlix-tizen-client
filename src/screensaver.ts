/**
 * S523 AD-21 — idle screen policy core (PRIVILEGE-HONEST, client-side only).
 *
 * All of the WHEN decision for the TV idle screensaver overlay lives here as
 * pure functions — no DOM, no timers, no network — so the whole decision table
 * (idle × playing × paused × key-reset) is unit-pinnable under fake timers.
 * The presentation + lifecycle half is `./components/ScreenSaverOverlay.vue`
 * (the always-mounted ninth root app).
 *
 * PRIVILEGE VERDICT (AC-1, verified live against `app/config.xml` at this
 * commit, mirrored byte-same by `package/config.xml`): the as-shipped manifest
 * grants EXACTLY two privileges — `http://tizen.org/privilege/internet` and
 * `http://tizen.org/privilege/tv.inputdevice` — and nothing else (S503 pruned
 * the five unused ones). Samsung Tizen keep-awake / screen-state control
 * (`tizen.display.setScreenDisplayState` and the webapis power/display hold
 * surfaces) requires `http://tizen.org/privilege/display`, which the manifest
 * does NOT grant; no other power API seam exists in `src/` (repo-wide grep at
 * execution found only the `tvinputdevice` reference in `remote/registerKeys.ts`).
 * The TN-2 / S503 law is that privileges fold in ONLY with their feature and
 * are never pre-added, so the keep-awake leg is WITHHELD — honestly reported
 * in the PR body instead of smuggled in behind a speculative privilege grant.
 * What ships is therefore the zero-privilege half described by this module.
 *
 * ZEROS this step keeps: zero manifest change, zero new request sites (this
 * module never touches the wire → `routeManifest.gate`'s scan stays 27 and the
 * vendored fixture is byte-identical, md5 06ce7ec9…), zero focus interaction.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

/** Jellyfin/tac0de idle convention: the overlay fires after 180 s of inactivity. */
export const IDLE_TIMEOUT_MS = 180_000;

/**
 * localStorage override slot for the idle window (dev/QA + photosensitive
 * users): a positive integer number of milliseconds. Anything else — empty,
 * garbage, fractional, non-positive — falls back to {@link IDLE_TIMEOUT_MS}.
 */
export const IDLE_TIMEOUT_KEY = 'phlix.screensaver.idleMs';

/** Body class present ONLY while the overlay is engaged (S523, jellyfin convention). */
export const IDLE_BODY_CLASS = 'screensaver-active';

/** Coarse cadence for the overlay's idle poll — idle windows are minutes, not frames. */
export const IDLE_TICK_MS = 1_000;

/** The minimal read surface {@link resolveIdleTimeoutMs} needs from storage. */
export interface IdleStorageRead {
  getItem(key: string): string | null;
}

/**
 * Parse (don't validate — Law 2) the persisted idle window into a trusted
 * number at the boundary. Absent key, non-numeric, fractional, or non-positive
 * values all yield the 180 s default; callers may trust the return completely.
 */
export function resolveIdleTimeoutMs(storage: IdleStorageRead): number {
  const raw = storage.getItem(IDLE_TIMEOUT_KEY);
  if (raw === null) return IDLE_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return IDLE_TIMEOUT_MS;
  return parsed;
}

/** Every input the idle decision needs, already trusted (Law 2 applies inside too). */
export interface IdleDecision {
  /** Current epoch ms. */
  now: number;
  /** Epoch ms of the last routed key (or of the last observed playing tick). */
  lastActivityAt: number;
  /** Parsed idle window from {@link resolveIdleTimeoutMs}. */
  timeoutMs: number;
  /** True while the player reports active playback. */
  isPlaying: boolean;
}

/**
 * The WHOLE policy, pure: the screensaver engages iff playback is NOT active
 * and the idle window has fully elapsed. Active playback vetoes the overlay
 * absolutely (burn-in risk class is the STATIC surface, and a screensaver over
 * a movie is simply wrong); a paused/browsing install is eligible; any routed
 * key resets `lastActivityAt`, which resets this verdict to false.
 */
export function shouldEngageScreenSaver({
  now,
  lastActivityAt,
  timeoutMs,
  isPlaying,
}: IdleDecision): boolean {
  if (isPlaying) return false;
  return now - lastActivityAt >= timeoutMs;
}
