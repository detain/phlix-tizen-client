/**
 * Tizen remote key registration (S509 — AD-1).
 *
 * On 2020+ Samsung TVs the webview does NOT deliver media-transport / channel /
 * colour / info keys to the DOM unless the app first declares them through the
 * `tizen.tvinputdevice` platform API (three independent studies — rtsp-samsung-tv,
 * tacplayer, pelagica — agree this is mandatory; without it the keys are simply
 * never fired). This module is that declaration.
 *
 * It stays a THIN, pure seam over the platform object: it registers the key names,
 * then RemoteManager's existing `document` keydown listener + KeyMapping's code
 * table do the actual dispatch. There is deliberately NO parallel key pipeline —
 * registering here is what lets the browser `keydown` fallback keep working, not a
 * replacement for it.
 *
 * Pure + fakeable like `deviceId.ts`: accept a `tizenLike` argument and guard the
 * ambient global, so unit tests drive a hand-built object and a non-Tizen (browser
 * dev / jsdom) run is a silent no-op.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

/** The subset of `tizen.tvinputdevice` this module touches. */
export interface TvInputDeviceLike {
  registerKey(key: string): boolean;
  unregisterKey(key: string): boolean;
}

/** The minimal structural shape of the ambient `tizen` object we read from. */
export interface TizenLike {
  tvinputdevice?: TvInputDeviceLike;
}

/**
 * The keys this client registers at app-ready. The transport set (play/pause/stop/
 * next/previous/rewind/fast-forward) is what the S509 brief names; `MediaPlayPause`
 * is the single-toggle variant (mapped to PLAY_PAUSE in KeyMapping, code 10252); the
 * channel keys (427/428 → CHANNEL_UP/DOWN) and the colour / Info keys round out the
 * set the survey mapped. Names are the Tizen `tvinputdevice` key identifiers.
 */
export const REMOTE_KEYS: readonly string[] = [
  'MediaPlay',
  'MediaPause',
  'MediaPlayPause',
  'MediaStop',
  'MediaFastForward',
  'MediaRewind',
  'MediaNext',
  'MediaPrevious',
  'NextChannel',
  'PreviousChannel',
  'Colors',
  'Info'
];

/**
 * Resolve the platform input-device API, or `null` when it is unavailable. A
 * non-Tizen webview (browser dev, jsdom) and a profile without the tvinputdevice
 * feature both land here — that is not an error, just an environment with nothing
 * to register (Law 1: guard the absent case first and return).
 */
function resolveTvInputDevice(tizenLike?: TizenLike | null): TvInputDeviceLike | null {
  const tizen = tizenLike ?? (globalThis as { tizen?: TizenLike }).tizen;
  const device = tizen?.tvinputdevice;
  if (!device || typeof device.registerKey !== 'function' || typeof device.unregisterKey !== 'function') {
    return null;
  }
  return device;
}

/**
 * Register `keys` with the platform, returning ONLY the names this call actually
 * acquired. Individual unsupported key names throw on some profiles, so each is
 * isolated (fail-soft per key) rather than aborting the whole set. Returns an empty
 * array when the platform API is absent — the honest browser-dev no-op.
 */
export function registerRemoteKeys(
  keys: readonly string[] = REMOTE_KEYS,
  tizenLike?: TizenLike | null
): readonly string[] {
  const device = resolveTvInputDevice(tizenLike);
  if (!device) {
    return [];
  }

  const registered: string[] = [];
  for (const key of keys) {
    try {
      device.registerKey(key);
      registered.push(key);
    } catch {
      // This profile rejects the name (e.g. an older panel without that key) —
      // skip it; the rest still register and RemoteManager's DOM fallback covers
      // whatever arrives regardless.
    }
  }
  return registered;
}

/** Release exactly the `keys` handed to it. Best-effort: a platform error on
 *  teardown must never break the caller's cleanup chain (mirrors probeStorage). */
export function unregisterRemoteKeys(
  keys: readonly string[],
  tizenLike?: TizenLike | null
): void {
  const device = resolveTvInputDevice(tizenLike);
  if (!device) {
    return;
  }
  for (const key of keys) {
    try {
      device.unregisterKey(key);
    } catch {
      // Nothing actionable during teardown.
    }
  }
}

/**
 * Paired lifecycle helper: register `keys` now and return a teardown that releases
 * ONLY what was acquired — the app-ready / teardown symmetry AC#1 requires, with no
 * listener leak. On a non-Tizen webview the teardown is a no-op and nothing was held.
 */
export function installRemoteKeyRegistration(
  tizenLike?: TizenLike | null,
  keys: readonly string[] = REMOTE_KEYS
): () => void {
  const held = registerRemoteKeys(keys, tizenLike);
  return () => {
    unregisterRemoteKeys(held, tizenLike);
  };
}
