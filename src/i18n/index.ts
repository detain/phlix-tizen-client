/**
 * Client-local i18n entry point — resolves the boot locale and hands the
 * `@phlix/ui` app factory its message-catalog overrides.
 *
 * ## The seam this wires (verified against the resolved v0.99.8 copy)
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
 * Every candidate is PARSED (Law 2): normalized against the registry (primary
 * BCP-47 subtag, with `pt` region-aware — see `normalizeLocaleTag`) and tested
 * against the catalog table, so only a `SupportedLocale` ever leaves
 * `resolveLocale` — downstream code never re-validates.
 *
 * ## Shipped locales (estate decision, 2026-09)
 *
 * en + the six estate locales es / fr / de / it / pt_BR / ja. The ui-catalog
 * translations are NOT authored here: `@phlix/ui` is the SSOT and its locale
 * bundles arrive as SHA-PINNED vendored copies in `src/i18n/ui-locale-bundles/`
 * (refresh via `scripts/sync-ui-locale-bundles.mjs`; drift-guarded by
 * `tests/unit/i18nLocales.test.ts`).
 *
 * ## Adding a 7th locale — the ui-seam half is three edits
 *
 * 1. Author it in phlix-ui (`src/i18n/locales/xx.ts` + its registry) and
 *    re-vendor: `node scripts/sync-ui-locale-bundles.mjs` after re-pinning the
 *    branch/sha in that script.
 * 2. `'xx'` enters `SupportedLocale` automatically — the union is
 *    `'en' | PhlixLocaleCode` and the code union comes from the vendored barrel.
 * 3. One registry line: `xx: () => configOf(LOCALE_MESSAGES.xx)`.
 *    (The tizen-own half lives in `src/i18n/tizen/index.ts` — see docs/i18n.md.)
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { PhlixMessages, PhlixMessagesConfig } from '@phlix/ui';
import { EN_MESSAGES } from './locales/en';
import type { PhlixLocaleCode } from './ui-locale-bundles';

/** Locales this client ships catalogs for. Union = the registry's key set;
 *  the six vendored tags come from the ui barrel, so the SSOT is one import. */
export type SupportedLocale = 'en' | PhlixLocaleCode;

/** Last-resort locale when no signal parses to a supported one. */
export const FALLBACK_LOCALE: SupportedLocale = 'en';

/** Every locale `resolveLocale` can select (mirrors the union; kept as data so
 *  tests and future Settings rows can enumerate it without type tricks). */
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt_BR',
  'ja',
];

/**
 * The vendored bundles are COMPLETE `PhlixMessages` tables — strict-typed with
 * `satisfies PhlixMessages` against the INSTALLED package catalog (the
 * v0.99.4-era key-skew relaxation was reverted at the v0.99.5 re-pin; see the
 * transform notes in `scripts/sync-ui-locale-bundles.mjs`). A full
 * `PhlixMessages` IS a valid `PhlixMessagesConfig` override — every group
 * present, every key a string — so this is a typed pass-through, no cast:
 * the compiler already proved key identity, nothing past this line
 * re-validates.
 */
function configOf(bundle: PhlixMessages): PhlixMessagesConfig {
  return bundle;
}

/**
 * Locale → async catalog loader. Loaders (not constants) keep module-load lazy and
 * hand each caller a fresh object, so a consumer mutating its override can
 * never poison another boot's table. Registry order is irrelevant; lookup is a
 * property access.
 */
const MESSAGE_CATALOGS: Record<SupportedLocale, () => Promise<PhlixMessagesConfig>> = {
  // EN is the static fallback floor: always in the boot chunk, never dynamic.
  en: () => Promise.resolve(EN_MESSAGES),
  // TIZ-S21: non-EN bundles load on demand (one chunk per locale) instead of
  // all six riding the boot chunk. Imported per-file, NOT via the vendored
  // ui-locale-bundles/index.ts barrel, which statically pulls every bundle.
  es: () => import('./ui-locale-bundles/es').then((m) => configOf(m.ES_MESSAGES)),
  fr: () => import('./ui-locale-bundles/fr').then((m) => configOf(m.FR_MESSAGES)),
  de: () => import('./ui-locale-bundles/de').then((m) => configOf(m.DE_MESSAGES)),
  it: () => import('./ui-locale-bundles/it').then((m) => configOf(m.IT_MESSAGES)),
  pt_BR: () => import('./ui-locale-bundles/pt_BR').then((m) => configOf(m.PT_BR_MESSAGES)),
  ja: () => import('./ui-locale-bundles/ja').then((m) => configOf(m.JA_MESSAGES)),
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
 * Parse a BCP-47-ish tag ('en-US', 'ES_es', ' es-419 ', 'pt_BR') into its
 * registry key. Splitting on both hyphen and underscore keeps legacy
 * `en_US`-style tags parseable. Empty/whitespace input yields `null` so the
 * caller's early-exit chain treats it as "no signal", never as locale ''.
 *
 * Region rule: the primary subtag wins for every locale EXCEPT Portuguese.
 * The estate ships one pt catalog — `pt_BR`, Brazilian, per the 2026-09
 * decision — and collapsing `pt-*` to bare `pt` would drop the only key the
 * registry has. So any `pt` signal (bare `pt`, `pt_BR`, or a foreign region
 * like `pt-PT`) resolves to `pt_BR`: presenting European-Portuguese viewers
 * their own-language Brazilian variant beats silently degrading them to
 * English, and a future second pt bundle is a registry addition, not a
 * resolver rewrite.
 */
export function normalizeLocaleTag(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0];
  if (primary === '') return null;
  return primary === 'pt' ? 'pt_BR' : primary;
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
 * the fallback catalog rather than throwing at boot. A failed catalog chunk
 * load also falls back to the fallback catalog. The returned object is a
 * FRESH copy of the group table each call (group keys re-copied), matching
 * the "always fresh object, never mutates" contract ui's own `mergeMessages`
 * upholds.
 */
export async function messagesForLocale(locale: string): Promise<PhlixMessagesConfig> {
  const parsed = normalizeLocaleTag(locale);
  const effective: SupportedLocale = isSupportedLocale(parsed) ? parsed : FALLBACK_LOCALE;
  let catalog: PhlixMessagesConfig;
  try {
    catalog = await MESSAGE_CATALOGS[effective]();
  } catch {
    // Chunk-load failure (flaky network / stale deploy): boot with the English
    // catalog rather than aborting. If even the fallback chunk fails, let it throw.
    catalog = await MESSAGE_CATALOGS[FALLBACK_LOCALE]();
  }
  // Two-level catalog by contract (ui types): fresh top level + shallow-copied
  // group maps, so callers can never mutate the registry's constants.
  // Object.fromEntries is ES2019 — safe on the chrome100 Tizen build target.
  return Object.fromEntries(
    Object.entries(catalog).map(([group, entries]) => [group, { ...entries }]),
  ) as PhlixMessagesConfig;
}
