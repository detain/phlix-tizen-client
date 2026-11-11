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
// cannot be edited client-side), crypto.randomUUID (Chrome 92 — RT-106: the
// vendored ui Menu component calls it UNGUARDED in setup(), and on the
// admitted 85–91 population the TypeError unmounts every Menu subtree; same
// vendored-call-site constraint as `.at`, same cure shape: install here),
// Object.hasOwn (Chrome 93 — RT-087: the pinia ^4.1.0 bump replaced pinia 3's
// `Object.prototype.hasOwnProperty.call` uses with `Object.hasOwn(...)` at
// three live sites in its patch/merge paths; dep-minified call sites, same
// constraint, same cure shape).

// `at` is ES2022 (tsconfig lib is ES2020); declare the polyfilled shape
// locally instead of widening the whole lib. DECLARED NON-OPTIONAL ON PURPOSE:
// this module IS the existence guarantee — it installs `at` before any import
// sees it (the file is main.ts's first import), and a future lib bump supplies
// the identical member for real. The optional spelling (`at?`) made every
// test-side call site a TS2722 "possibly undefined" with no way to be honest,
// which the W-min173 tests-tsconfig gate measured.
declare global {
  interface Array<T> {
    at(index: number): T | undefined;
  }
  // Same law as `at` above: ES2022 member declared against the ES2020 lib,
  // NON-OPTIONAL because this module IS the existence guarantee. A future
  // lib bump merges the identical native signature.
  interface ObjectConstructor {
    hasOwn(target: object, propertyKey: PropertyKey): boolean;
  }
}

if (typeof globalThis.structuredClone !== 'function') {
  // Deep-clone fallback. Adequate for the JSON-safe config/state objects
  // phlix-ui clones; intentionally narrow (no Map/Set/Date support needed).
  (globalThis as { structuredClone: <T>(_value: T) => T }).structuredClone = <T>(_value: T): T =>
    JSON.parse(JSON.stringify(_value)) as T;
}

/**
 * Installs the `Array.prototype.at` fallback. Exported so the M-TIZEN-03
 * tests can drive the guard inside a SYNCHRONOUS absent-native window:
 * vite 8's module runner (which executes every `await import()` under
 * vitest) calls `Array.prototype.at` on its own import callstack, so the
 * pre-2026-11-11 fixture pattern of deleting the global across a dynamic
 * import poisons the runner, not the guard. The wave that bumped
 * `vite ^8.3.8` moved the seam; the guard logic below is untouched.
 */
export function installArrayAt(): void {
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
}

installArrayAt();

if (
  typeof globalThis.crypto !== 'undefined' &&
  typeof globalThis.crypto.randomUUID !== 'function' &&
  typeof globalThis.crypto.getRandomValues === 'function'
) {
  // crypto.randomUUID (Chromium 92) — RT-106. The vendored ui Menu component
  // calls it UNGUARDED inside setup(); on the admitted 85–91 population the
  // TypeError unmounts every Menu subtree. Call sites are vendored minified
  // JS (same constraint as `.at` above), so the cure installs the canonical
  // RFC 4122 v4 shape over crypto.getRandomValues (a Chrome 1-era API, safe
  // to claim at the floor). The getRandomValues precondition is the honesty
  // clause: with no entropy source present the shim stays inert and the
  // vendored GUARDED sites keep their own fallbacks. Non-enumerable install
  // via defineProperty mirrors the native descriptor; writable/configurable
  // so a newer engine's own member wins.
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: function randomUUID(): string {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
      let hex = '';
      for (let i = 0; i < 16; i++) hex += (bytes[i] + 0x100).toString(16).slice(1);
      return (
        hex.slice(0, 8) +
        '-' + hex.slice(8, 12) +
        '-' + hex.slice(12, 16) +
        '-' + hex.slice(16, 20) +
        '-' + hex.slice(20, 32)
      );
    },
    writable: true,
    configurable: true
  });
}

if (typeof Object.hasOwn !== 'function') {
  // Object.hasOwn (Chromium 93) — RT-087. pinia ^4.1.0 replaced pinia 3's
  // `Object.prototype.hasOwnProperty.call(...)` idiom with `Object.hasOwn(...)`
  // at three live sites in its shipped dist (two in the reactive-object state
  // merge, one in the store-symbol membership check), and the call sites are
  // dependency-minified JS the client cannot edit — same constraint as `.at`
  // and `randomUUID` above, same cure: install at the sanctioned point. The
  // shim body delegates to hasOwnProperty.call, which shares the native's
  // observable semantics for the domain that matters: both ToObject-coerce
  // the target (primitives box; `null`/`undefined` throw TypeError) and both
  // answer the OWN-property question identically. `Object.prototype
  // .hasOwnProperty` itself is ES1 — nothing to be honest about above the
  // floor. Non-enumerable install via defineProperty mirrors the
  // native descriptor; writable/configurable so a newer engine's own
  // member wins. The guard reads `Object.hasOwn` WITHOUT a call — the
  // distApiFloor call-census regex `/Object\.hasOwn\(/` stays dep-only.
  Object.defineProperty(Object, 'hasOwn', {
    value: function hasOwn(target: object, propertyKey: PropertyKey): boolean {
      return Object.prototype.hasOwnProperty.call(target, propertyKey);
    },
    writable: true,
    configurable: true
  });
}
