/**
 * Shipped locale bundles for the message catalog.
 *
 * Each bundle is a COMPLETE translation of `DEFAULT_MESSAGES` (every group, every
 * key), typed with `satisfies PhlixMessages` so a missing or extra key against the
 * English catalog is a COMPILE error, not a runtime fallback. Plural segments follow
 * the CLDR category count of the target language (two for es/fr/de/it/pt_BR, one for
 * ja — Japanese does not pluralize, so pipe-form English collapses to a single
 * counter-phrase segment). Invariants are re-checked at test time by
 * `src/i18n/locales.test.ts` (key-set identity, placeholder parity, segment counts).
 *
 * Usage — the config-time seam is unchanged; a locale bundle is just a full
 * `PhlixMessages` passed as `PhlixAppConfig.messages`:
 *
 *   import { createPhlixApp, JA_MESSAGES } from '@phlix/ui';
 *   createPhlixApp({ ..., messages: JA_MESSAGES });
 *
 * Adding a 7th locale: create `xx.ts` mirroring the group/key order of
 * `messages.ts`, type it `satisfies PhlixMessages`, register it in
 * `LOCALE_MESSAGES` below, and add one entry to the table in
 * `locales.test.ts` (expected plural-segment count + sanity rule). The compiler
 * enumerates unfinished keys; the suite enumerates parity.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */

import type { PhlixMessages } from '@phlix/ui';
import { ES_MESSAGES } from './es';
import { FR_MESSAGES } from './fr';
import { DE_MESSAGES } from './de';
import { IT_MESSAGES } from './it';
import { PT_BR_MESSAGES } from './pt_BR';
import { JA_MESSAGES } from './ja';

export { ES_MESSAGES, FR_MESSAGES, DE_MESSAGES, IT_MESSAGES, PT_BR_MESSAGES, JA_MESSAGES };

/** BCP-47-style tags of every complete locale bundle this package ships. */
export type PhlixLocaleCode = 'es' | 'fr' | 'de' | 'it' | 'pt_BR' | 'ja';

/**
 * Tag → bundle registry. Typed `Record<PhlixLocaleCode, PhlixMessages>` so the
 * compiler forces every declared tag to carry a full bundle (and vice versa the
 * union is the single enumeration `LOCALE_MESSAGES[code]` can resolve).
 */
export const LOCALE_MESSAGES: Record<PhlixLocaleCode, PhlixMessages> = {
  es: ES_MESSAGES,
  fr: FR_MESSAGES,
  de: DE_MESSAGES,
  it: IT_MESSAGES,
  pt_BR: PT_BR_MESSAGES,
  ja: JA_MESSAGES,
};
