/**
 * Tizen TV client entry point and boot glue.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// Polyfills for older Samsung Tizen webviews (pre-Chrome 98).
// MUST be imported first, before any @phlix/ui code runs — phlix-ui's
// SettingsForm relies on structuredClone, which older Tizen Chromium lacks.
//
// The repo's runtime engine contract is Chromium >= 85 — the SINGLE canonical
// statement (measured matrix + governance) lives in docs/runtime-floor.md and
// is tripwire-enforced by tests/unit/distApiFloor.test.ts against the
// committed package/ bundle. This file is the sanctioned polyfill point: an
// above-floor runtime API may ship ONLY if installed here (or pinned inert
// with rationale in the floor doc). Current installs: structuredClone (Chrome
// 98), Array.prototype.at (Chrome 92 — the vendored ui PosterPicker chunk
// calls `.at(-1)` at three live sites; the call sites are vendored JS and
// cannot be edited client-side).

// `at` is ES2022 (tsconfig lib is ES2020); declare the polyfilled shape
// locally instead of widening the whole lib. If a future lib bump supplies
// `at` for real, this optional member merges without conflict.
declare global {
  interface Array<T> {
    at?(index: number): T | undefined;
  }
}

if (typeof globalThis.structuredClone !== 'function') {
  // Deep-clone fallback. Adequate for the JSON-safe config/state objects
  // phlix-ui clones; intentionally narrow (no Map/Set/Date support needed).
  (globalThis as { structuredClone: <T>(_value: T) => T }).structuredClone = <T>(_value: T): T =>
    JSON.parse(JSON.stringify(_value)) as T;
}

if (typeof Array.prototype.at !== 'function') {
  // Array.prototype.at (Chromium 92) — spec-faithful for the integer-index
  // read the bundle actually performs: ToIntegerOrInfinity-ish coercion
  // (truncate toward zero, NaN -> +0, +/-Infinity preserved), negative
  // indices count from the end, out-of-range reads yield undefined. Installed
  // via defineProperty so the method is non-enumerable like the native one
  // (descriptor defaults: enumerable false). writable/configurable true to
  // match the native descriptor and let a newer engine's own install win.
  Object.defineProperty(Array.prototype, 'at', {
    value: function at(this: unknown[], index: number): unknown {
      const length = this.length;
      // Math.trunc: NaN -> NaN (then || 0 -> +0), -0 -> -0 (|| 0 -> +0, same
      // slot), +/-Infinity pass through, fractional truncates toward zero.
      let k = Math.trunc(index) || 0;
      if (k < 0) k += length;
      if (k < 0 || k >= length) return undefined;
      return this[k];
    },
    writable: true,
    configurable: true
  });
}
