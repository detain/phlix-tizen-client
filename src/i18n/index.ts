/**
 * Client-local i18n entry point — resolves the boot locale and hands the
 * `@phlix/ui` app factory its message-catalog overrides.
 *
 * ## The seam this wires (verified against the resolved v0.99.4 copy)
 *
 * `@phlix/ui` exposes a CONFIG-TIME i18n seam: `PhlixAppConfig.messages`
 * (a `PhlixMessagesConfig` = deep-partial `group.key` override map,
 * `dist/app/types.d.ts:115`). `createPhlixApp` spreads the consumer config and
 * `provide()`s it under `'phlixConfig'`; every `useMessages()` call injects it
 * and builds a translator via `createTranslator(config?.messages)`
 * (`dist/composables/useMessages.d.ts`, ui `src/composables/useMessages.ts`).
 * Before this module the Tizen client passed no `messages`, so the seam existed
 * but was unreachable from the client.
 *
 * ## Merge semantics we rely on (mirrored from ui `mergeMessages`)
 *
 * The catalog is exactly TWO levels (`group.key`). ui merges per group:
 * `{ ...DEFAULT_MESSAGES[group], ...overrides[group] }` for every group that
 * EXISTS in the defaults — an override for an unknown group is dropped, an
 * override for an unknown key inside a known group rides along but nothing
 * renders it. So a locale file may only override known `group.key` pairs;
 * partial groups are fine (omitted keys fall back to ui's English).
 *
 * ## Locale priority (highest first)
 *
 * 1. `explicit`  — a caller-supplied app-config value (future Settings UI /
 *    embedded launcher param threads through this argument).
 * 2. `env`       — `VITE_PHLIX_LOCALE` build-time constant.
 * 3. `navigatorLanguage` — the unprivileged webview signal. Tizen doctrine
 *    forbids `tizen.systeminfo` device-locale calls without an extra privilege
 *    (see src/discovery/lanDiscovery.ts precedent); `navigator.language` needs
 *    none and exists in every TV webview Chromium shell.
 * 4. `FALLBACK_LOCALE` ('en').
 *
 * Every candidate is PARSED (Law 2): normalized to a primary BCP-47 subtag and
 * tested against the registry, so only a `SupportedLocale` ever leaves
 * `resolveLocale` — downstream code never re-validates.
 *
 * ## Adding a locale (e.g. Spanish) — exactly three edits
 *
 * 1. New file `src/i18n/locales/es.ts` exporting `ES_MESSAGES: PhlixMessagesConfig`
 *    with only the `group.key` strings you translate (partial groups OK).
 * 2. Add `'es'` to the `SupportedLocale` union + `SUPPORTED_LOCALES` below.
 * 3. Add one registry line: `es: () => ES_MESSAGES`.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { PhlixMessagesConfig } from '@phlix/ui';
import { EN_MESSAGES } from './locales/en';

/** Locales this client ships catalogs for. Union = the registry's key set. */
export type SupportedLocale = 'en';

/** Last-resort locale when no signal parses to a supported one. */
export const FALLBACK_LOCALE: SupportedLocale = 'en';

/** Every locale `resolveLocale` can select (mirrors the union; kept as data so
 *  tests and future Settings rows can enumerate it without type tricks). */
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en'];

/**
 * Locale → catalog factory. Factories (not constants) keep module-load lazy and
 * hand each caller a fresh object, so a consumer mutating its override can
 * never poison another boot's table. Registry order is irrelevant; lookup is a
 * property access.
 */
const MESSAGE_CATALOGS: Record<SupportedLocale, () => PhlixMessagesConfig> = {
  en: () => EN_MESSAGES,
};

/** Inputs `resolveLocale` considers, highest priority first. */
export interface LocaleSignals {
  /** Explicit app-config value (Settings choice, launcher param, …). */
  explicit?: string | null;
  /** Build-time env value; defaults to `import.meta.env.VITE_PHLIX_LOCALE`. */
  env?: string | null;
  /** Browser/webview language; defaults to `navigator.language`. */
  navigatorLanguage?: string | null;
}

/**
 * Parse a BCP-47-ish tag ('en-US', 'ES_es', ' es-419 ') down to its lowercased
 * primary subtag ('en', 'es'). Splitting on both hyphen and underscore keeps
 * legacy `en_US`-style tags parseable. Empty/whitespace input yields `null` so
 * the caller's early-exit chain treats it as "no signal", never as locale ''.
 */
export function normalizeLocaleTag(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0];
  return primary === '' ? null : primary;
}

/** Whether a normalized primary subtag has a catalog in this client. */
export function isSupportedLocale(tag: string | null): tag is SupportedLocale {
  return tag !== null && Object.prototype.hasOwnProperty.call(MESSAGE_CATALOGS, tag);
}

/** Platform reads, applied only where a signal was not explicitly supplied —
 *  so tests pass everything and stay pure, while boot reads the real world. */
function defaultSignalEnvironment(): Pick<LocaleSignals, 'env' | 'navigatorLanguage'> {
  return {
    env: import.meta.env.VITE_PHLIX_LOCALE ?? null,
    // Optional chain: a non-DOM host (worker, odd test) simply offers no signal.
    navigatorLanguage: globalThis.navigator?.language ?? null,
  };
}

/**
 * Resolve the effective locale. Pure over its `signals` argument (Law 3): same
 * signals → same locale; unspecified slots are filled from the environment.
 * Returns the first supported parse; never throws, never returns unsupported.
 */
export function resolveLocale(signals: LocaleSignals = {}): SupportedLocale {
  const environment = defaultSignalEnvironment();
  const candidates = [
    signals.explicit ?? null,
    signals.env ?? environment.env,
    signals.navigatorLanguage ?? environment.navigatorLanguage,
  ];
  for (const candidate of candidates) {
    const parsed = normalizeLocaleTag(typeof candidate === 'string' ? candidate : null);
    if (isSupportedLocale(parsed)) return parsed;
  }
  return FALLBACK_LOCALE;
}

/**
 * The ui `PhlixAppConfig.messages` override map for a locale. The input is
 * parsed (Law 2): anything unsupported — including a mistyped locale — selects
 * the fallback catalog rather than throwing at boot. The returned object is a
 * FRESH copy of the group table each call (group keys re-copied), matching the
 * "always fresh object, never mutates" contract ui's own `mergeMessages` upholds.
 */
export function messagesForLocale(locale: string): PhlixMessagesConfig {
  const parsed = normalizeLocaleTag(locale);
  const effective: SupportedLocale = isSupportedLocale(parsed) ? parsed : FALLBACK_LOCALE;
  const catalog = MESSAGE_CATALOGS[effective]();
  // Two-level catalog by contract (ui types): fresh top level + shallow-copied
  // group maps, so callers can never mutate the registry's constants.
  // Object.fromEntries is ES2019 — safe on the chrome100 Tizen build target.
  return Object.fromEntries(
    Object.entries(catalog).map(([group, entries]) => [group, { ...entries }]),
  ) as PhlixMessagesConfig;
}
