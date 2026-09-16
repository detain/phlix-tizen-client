/**
 * languageLadder — the pure track-language preference resolver (S511 / AD-18).
 *
 * Two memory layers decide which audio/subtitle language a title should open
 * with, tried in order and stopped at the first one the item actually offers:
 *
 *   1. per-item   — the language the viewer last picked for THIS title
 *                   (`useTrackPreferenceStore` localStorage slot), and
 *   2. server     — the account-wide preference the server returns from
 *                   `GET /api/v1/users/me/settings`
 *                   (`preferred_audio_language` / `preferred_subtitle_language`).
 *
 * If neither names a language present on the item's track rows, the resolver
 * returns `{ language: null }` — meaning "change nothing", which is EXACTLY
 * today's behaviour (S511 AC2: absent-preference stays byte-identical). The
 * server pre-seeds a default (`en`) for every account, so the "no match" branch
 * — a named language the item has no row for — is the honest definition of
 * "absent" here, alongside the empty/failed fetch the store maps to `null`.
 *
 * Matching is case/whitespace tolerant on the LANGUAGE value (BCP-47 base tags
 * arrive as `en`, occasionally `EN`), but the resolver hands back the item's
 * OWN wire string so callers can compare it against `track.language` verbatim
 * and feed it straight to the player store. No network, no Vue, no storage —
 * this module is pure by design (code-philosophy: Atomic Predictability).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

/** Which of the two memory layers produced the resolved language. */
export type LanguageLadderSource = 'per-item' | 'server' | 'none';

export interface LanguageLadderInput {
  /** The per-item stored choice, or `null`/empty when the viewer never picked one. */
  perItem?: string | null;
  /** The account/server preference, or `null`/empty when unset or the fetch failed. */
  server?: string | null;
  /** The `language` values actually present on this item's track rows. */
  availableLanguages: readonly (string | null | undefined)[];
}

export interface LanguageLadderResult {
  /**
   * The language to adopt as the default track selection, or `null` when no
   * preference applies (leave the player/store exactly as it is).
   */
  language: string | null;
  /** Which layer won — `none` when nothing was adopted. */
  source: LanguageLadderSource;
}

/** Trim + lowercase a language tag; empty / non-string normalises to `null`. */
function normalizeLanguage(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve the default track language for one item, one kind (audio|subtitle).
 *
 * Guard-first (code-philosophy: Early Exit): with no candidate named there is
 * nothing to match, so we return the identity result before touching the set.
 */
export function resolvePreferredLanguage(
  input: LanguageLadderInput,
): LanguageLadderResult {
  const perItem = normalizeLanguage(input.perItem);
  const server = normalizeLanguage(input.server);

  if (perItem === null && server === null) {
    return { language: null, source: 'none' };
  }

  // Index the item's real languages by their normalised key, keeping the first
  // wire spelling seen so the returned value matches `track.language` verbatim.
  const available = new Map<string, string>();
  for (const raw of input.availableLanguages) {
    const key = normalizeLanguage(raw);
    if (key !== null && !available.has(key)) {
      available.set(key, raw as string);
    }
  }

  // Per-item memory wins, but only when this title actually offers the language.
  if (perItem !== null && available.has(perItem)) {
    return { language: available.get(perItem)!, source: 'per-item' };
  }
  // Otherwise fall back to the account preference, same availability test.
  if (server !== null && available.has(server)) {
    return { language: available.get(server)!, source: 'server' };
  }
  // A preference was named but no row matches it → treat as absent (AC2).
  return { language: null, source: 'none' };
}
