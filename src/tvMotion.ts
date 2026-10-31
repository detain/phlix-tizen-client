/**
 * tvMotion — the TV-era GPU posture for the vendored ui's backdrop layer.
 *
 * WHY (M-TIZEN-35 / review tizen__gameux m6): the sealed index bundle carries
 * 52 `backdrop-filter` declarations (glass shelves, halos, cards) written for
 * desktop compositors; on a Tizen webview they re-rasterize the blurred region
 * on EVERY repaint — the dropped frames during D-pad shelf scrolls the review
 * named. The ui gates its HEAVIEST backdrop on a `prefs.atmosphere` setting,
 * but that gate covers one layer (AppLayout/AppBackdrop), the preference is
 * server-backed, and at this pin the store shape the host can reach
 * (`useSettingsPrefs`) does not carry atmosphere at all. The 51 other rules —
 * and the CSS side generally — never got the same tuning pass the HLS profile
 * got (TIZEN_HLS_CONFIG is the in-repo precedent for "ship TV-era defaults").
 *
 * THE CURE: a host stylesheet (src/styles/tv-motion.css, imported after the
 * vendor stylesheets — the tv-typography import-order idiom) that neutralizes
 * backdrop blur under a body class, and this module deciding the class.
 * TV-ERA DEFAULT: lite (blur off). Opt back in with localStorage
 * `phlix.tvMotion` = `'full'` — the same storage-key escape-hatch idiom as the
 * screensaver idle override (phlix.screensaverIdleMs), readable by any future
 * settings surface.
 *
 * WHY NOT BLANKET-CAP TRANSITIONS TOO: the review's count includes 296
 * `transition` rules, but a duration override is a TRAP: forcing every
 * transition to one value ADDS motion where the ui deliberately uses `0s`
 * (instant state flips would start animating) and re-tunes intent per surface.
 * The compositor cost gameux observed on shelf scroll IS the blur (transitions
 * are cheap once the blurred backdrop is gone); the blur kill is the whole
 * mitigation. This tradeoff is disclosed, not hidden.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

/** Storage key whose value `'full'` opts the device back into full atmosphere. */
export const TV_MOTION_KEY = 'phlix.tvMotion';

/** Body class the lite posture is keyed on (the CSS + this module's contract). */
export const TV_MOTION_LITE_CLASS = 'tv-motion-lite';

export interface TvMotionStorageRead {
  getItem(key: string): string | null;
}

/**
 * Pure decide: the ONLY recognized opt-out is the exact string `'full'`;
 * absent, empty, garbage, or anything else lands on the TV-era default (lite).
 */
export function resolveTvMotionLite(storage: TvMotionStorageRead): boolean {
  return storage.getItem(TV_MOTION_KEY) !== 'full';
}

/**
 * Apply the posture to a body element. Split out (pure-ish, DOM-injected) so
 * boot wiring and tests share ONE implementation.
 */
export function applyTvMotionClass(
  storage: TvMotionStorageRead,
  body: Pick<HTMLElement, 'classList'>,
): boolean {
  const lite = resolveTvMotionLite(storage);
  body.classList.toggle(TV_MOTION_LITE_CLASS, lite);
  return lite;
}
