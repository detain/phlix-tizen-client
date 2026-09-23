/**
 * Tizen-OWN message catalog — the accessor half of `src/i18n/tizen/`.
 *
 * ## Why a second catalog beside the ui seam
 *
 * `src/i18n/index.ts` overrides the strings `@phlix/ui` RENDERS (via
 * `PhlixAppConfig.messages`). This module serves the strings the Tizen client
 * itself renders OUTSIDE that seam — boot chrome, TV overlays, D-pad lists, the
 * Quick-Connect panel, and the client-owned pages. Those components mount as
 * separate Vue roots sharing only pinia + router, so ui's provide/inject
 * `useMessages()` cannot reach them; they resolve through the plain function
 * below instead.
 *
 * ## Semantics mirror ui's `createTranslator` on purpose
 *
 * - Catalog shape: two levels (`group.key`), values `string`.
 * - Interpolation: `{param}` tokens replaced from the params object; a token
 *   with no matching param rides through untouched (ui `interpolate`).
 * - Plural pipe form: `'{n} item | {n} items'` templates select a form by
 *   `params.count` via `Intl.PluralRules` BEFORE interpolation, degrading to
 *   the last (other) form when `count` is missing — the exact safety net ui
 *   ships, reused through `@phlix/ui`'s exported helpers (no forked plural math).
 * - Unknown key echoes the key (typed keys make that a compile error first).
 * - Override merge: per-group spread over the English base; an override for an
 *   unknown GROUP is dropped, an unknown key inside a known group rides along
 *   unrendered. Partial groups fall back to English per key.
 *
 * ## Locale flow
 *
 * The effective locale is the SINGLE `resolveLocale()` result from
 * `src/i18n/index.ts` — boot threads it through `setTizenLocale` so the ui
 * seam and the own-strings catalog can never disagree. Until boot sets it (and
 * in pure tests), the accessor lazily resolves from the same signals.
 *
 * ## Adding a locale — exactly two edits (the estate six shipped 2026-09)
 *
 * 1. New file `src/i18n/tizen/locales/xx.ts` exporting
 *    `XX_TIZEN_MESSAGES satisfies TizenCatalog` (full translation — the
 *    compiler forces key-set parity with English; a deliberate partial may
 *    instead declare `satisfies TizenMessagesConfig`).
 * 2. One registry line: `xx: () => XX_TIZEN_MESSAGES`.
 *    (`src/i18n/index.ts` covers the ui-seam half via the vendored bundles.)
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { isPluralTemplate, selectPluralTemplate } from '@phlix/ui';
import {
  FALLBACK_LOCALE,
  isSupportedLocale,
  normalizeLocaleTag,
  resolveLocale,
  type SupportedLocale,
} from '../index';
import {
  TIZEN_EN,
  type TizenCatalog,
  type TizenMessageGroup,
  type TizenMessageKey,
  type TizenMessagesConfig,
} from './locales/en';
import { ES_TIZEN_MESSAGES } from './locales/es';
import { FR_TIZEN_MESSAGES } from './locales/fr';
import { DE_TIZEN_MESSAGES } from './locales/de';
import { IT_TIZEN_MESSAGES } from './locales/it';
import { PT_BR_TIZEN_MESSAGES } from './locales/pt_BR';
import { JA_TIZEN_MESSAGES } from './locales/ja';

export type {
  TizenCatalog,
  TizenMessageGroup,
  TizenMessageKey,
  TizenMessagesConfig,
} from './locales/en';
export { TIZEN_EN } from './locales/en';

/**
 * Params a translated string may interpolate: mirrors ui `TranslateParams`,
 * plus the nullish half of the documented ride-through contract — a `null`
 * or `undefined` value leaves its `{token}` in place (see `interpolate`),
 * which is exactly how optional call-site data (e.g. a recommendation's
 * missing `year`) reaches a key that never renders that token.
 */
export type TizenTranslateParams = Record<string, string | number | null | undefined>;

/** The resolver shape returned by {@link createTizenTranslator}. */
export type TizenTranslate = (key: TizenMessageKey, params?: TizenTranslateParams) => string;

/** Exactly the ui `PARAM_PATTERN` — `{word}` tokens. */
const PARAM_PATTERN = /\{(\w+)\}/g;

/**
 * Replace `{token}`s from `params`; an unmatched token stays literal (ui
 * `interpolate` parity, so a template/params drift degrades visibly, not blank).
 */
function interpolate(template: string, params?: TizenTranslateParams): string {
  if (!params) return template;
  return template.replace(PARAM_PATTERN, (match, name: string) => {
    const value = params[name];
    return value === undefined || value === null ? match : String(value);
  });
}

/**
 * Resolve a pipe-form plural template to one form by `params.count` (ui
 * `selectPlural` parity: missing/non-numeric count degrades to the LAST form —
 * the `other` slot — never leaking `|` punctuation into the UI).
 */
function selectPlural(template: string, params?: TizenTranslateParams): string {
  if (!isPluralTemplate(template)) return template;
  const raw = params?.['count'];
  const count = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(count)) {
    const parts = template.split('|');
    return parts[parts.length - 1]!.trim();
  }
  return selectPluralTemplate(template, count);
}

/**
 * Overlay a (deep-partial) locale table on the English base, group by group.
 * Only groups present in `TIZEN_EN` survive — mirroring ui's `mergeMessages`
 * law, so a typo'd group is dropped loudly-by-absence rather than half-rendered.
 * Fresh objects every call; the base tables are never mutated.
 */
export function mergeTizenMessages(overrides?: TizenMessagesConfig): TizenCatalog {
  if (!overrides) return TIZEN_EN;
  const merged = {} as Record<string, Record<string, string>>;
  for (const group of Object.keys(TIZEN_EN) as TizenMessageGroup[]) {
    const base = TIZEN_EN[group] as unknown as Record<string, string>;
    const override = (overrides as Record<string, Record<string, string> | undefined>)[group];
    merged[group] = override ? { ...base, ...override } : { ...base };
  }
  return merged as unknown as TizenCatalog;
}

/**
 * Build a `t(key, params?)` resolver over the English base overlaid with
 * `overrides`. Pure: same overrides → equivalent resolver, zero shared state.
 */
export function createTizenTranslator(overrides?: TizenMessagesConfig): TizenTranslate {
  const messages = mergeTizenMessages(overrides) as unknown as Record<
    string,
    Record<string, string>
  >;
  return (key, params) => {
    const dot = key.indexOf('.');
    const group = dot === -1 ? '' : key.slice(0, dot);
    const leaf = dot === -1 ? '' : key.slice(dot + 1);
    const groupObj = messages[group];
    const template = groupObj ? groupObj[leaf] : undefined;
    if (typeof template !== 'string') {
      // Fail LOUD in dev (task law): an unknown key is a bug, never a silent
      // UI regression. Production keeps ui's quiet key-echo contract.
      if (import.meta.env.DEV) console.warn('[phlix:i18n:tizen] unknown message key:', key);
      return key;
    }
    return interpolate(selectPlural(template, params), params);
  };
}

/**
 * Locale → own-catalog override factory. `en` is the BASE table itself, so its
 * override is empty by contract (mirrors the ui-seam `locales/en.ts` decision).
 * The six estate locales ship FULL tables (`satisfies TizenCatalog`-checked —
 * see `tests/unit/i18nLocales.test.ts`), still merged per group so any future
 * key added to English falls back cleanly until translated.
 * Factories keep module-load lazy and hand each merge a fresh object.
 */
const TIZEN_CATALOG_OVERRIDES: Record<SupportedLocale, () => TizenMessagesConfig> = {
  en: () => ({}),
  es: () => ES_TIZEN_MESSAGES,
  fr: () => FR_TIZEN_MESSAGES,
  de: () => DE_TIZEN_MESSAGES,
  it: () => IT_TIZEN_MESSAGES,
  pt_BR: () => PT_BR_TIZEN_MESSAGES,
  ja: () => JA_TIZEN_MESSAGES,
};

/** Boot-pinned locale; `null` until `setTizenLocale` runs (tests, pre-boot). */
let pinnedLocale: SupportedLocale | null = null;

/** Translator memo, invalidated whenever the effective locale changes. */
let cachedLocale: SupportedLocale | null = null;
let cachedTranslator: TizenTranslate | null = null;

/**
 * Pin the own-catalog locale. Input is PARSED (Law 2) exactly like
 * `messagesForLocale`: a mistyped/unsupported tag selects the fallback rather
 * than throwing at boot. Boot calls this with the same `resolveLocale()`
 * result it hands the ui seam, keeping one locale truth for the whole client.
 */
export function setTizenLocale(locale: string): void {
  const parsed = normalizeLocaleTag(locale);
  pinnedLocale = isSupportedLocale(parsed) ? parsed : FALLBACK_LOCALE;
}

/** The effective own-catalog locale: pinned value, else lazily resolved. */
export function tizenLocale(): SupportedLocale {
  return pinnedLocale ?? resolveLocale();
}

/** Reset to the un-pinned state (tests only — production pins once at boot). */
export function clearTizenLocale(): void {
  pinnedLocale = null;
}

/**
 * Translate a tizen-own `group.key` string in the effective locale. The whole
 * client resolves its chrome text through this one function; the translator is
 * built once per locale and cached until the locale changes.
 */
export function tTizen(key: TizenMessageKey, params?: TizenTranslateParams): string {
  const locale = tizenLocale();
  if (locale !== cachedLocale || !cachedTranslator) {
    cachedTranslator = createTizenTranslator(TIZEN_CATALOG_OVERRIDES[locale]());
    cachedLocale = locale;
  }
  return cachedTranslator(key, params);
}
