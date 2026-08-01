/**
 * Tizen TV client entry point and boot glue.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// Polyfills for older Samsung Tizen webviews (pre-Chrome 98).
// MUST be imported first, before any @phlix/ui code runs — phlix-ui's
// SettingsForm relies on structuredClone, which older Tizen Chromium lacks.

if (typeof globalThis.structuredClone !== 'function') {
  // Deep-clone fallback. Adequate for the JSON-safe config/state objects
  // phlix-ui clones; intentionally narrow (no Map/Set/Date support needed).
  (globalThis as { structuredClone: <T>(_value: T) => T }).structuredClone = <T>(_value: T): T =>
    JSON.parse(JSON.stringify(_value)) as T;
}
