/**
 * English message-catalog overrides for the `@phlix/ui` i18n seam.
 *
 * Deliberately EMPTY. `@phlix/ui` already ships English as its `DEFAULT_MESSAGES`
 * catalog, and its `mergeMessages()` overlays consumer overrides ON TOP of those
 * defaults per group — so the correct English entry in a CLIENT override table is
 * the empty map: every key falls through to the ui default, byte-for-byte, with
 * zero duplicated strings to drift. (If the client ever needs to diverge a single
 * English string — e.g. a TV-specific wording — it lands HERE, not by forking ui.)
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { PhlixMessagesConfig } from '@phlix/ui';

export const EN_MESSAGES: PhlixMessagesConfig = {};
