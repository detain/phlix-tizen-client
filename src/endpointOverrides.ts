/**
 * endpointOverrides — the operator escape hatch for non-default SyncPlay
 * endpoints (M-TIZEN-07 / review tizen__crossfe m7, W-min171).
 *
 * THE PROBLEM the review caught: this client hard-codes both SyncPlay
 * endpoints — `:8097` in `buildWsUrl` (direct lane) and `:8804` +
 * `/syncplay/{serverId}` in `buildHubRelayUrl` (relay lane) — while the
 * estate has grown endpoint seams everywhere else: server ListenEndpoints
 * (server 7b7bf215), hub HUB_WS_URL/HUB_WS_PATH (hub 6175184), and the ui's
 * v0.99.13 socketHint seam (`window.__PHLIX__.wsUrl/wsPath`, read lazily at
 * every dial — review M11 wires it in `src/syncplaySocketHint.ts`). A
 * deployment that mounts those services on custom ports/paths splits-brain
 * against the TV: REST works (apiBase is configurable), the room socket
 * silently dials the wrong door. Both lanes carry the override: the tizen
 * re-implementations read these keys at DIAL time, and the sealed-bundle
 * surface is fed the derived hint through the ui seam — one truth, two
 * consumers.
 *
 * THE SHAPE: localStorage keys, read at dial time (a settings surface, not
 * an operator rebuild), validated to death here, DEFAULT-ON-INVALID (a
 * garbage value can never wedge the socket — the shipped default is always
 * reachable):
 *   - `phlix.syncplayPort` — direct-lane :8097 replacement (digits only,
 *     1..65535). Host ALWAYS stays the apiBase hostname; the override is the
 *     port ONLY, so it can never repoint bearer traffic at a foreign host.
 *   - `phlix.relayPort` / `phlix.relayPath` — relay-lane :8804 / `/syncplay`
 *     mount replacement (path: absolute, no query/fragment/space/double
 *     slash, ≤200 chars). The hub origin itself stays the configured slot's
 *     job (M-TIZEN-06/07 storage gates keep policing THAT).
 * Documented in README (Configuration table) — invisible-to-readers was half
 * the finding.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

/** Direct-lane SyncPlay port key (replaces the `:8097` constant). */
export const SYNCPLAY_PORT_KEY = 'phlix.syncplayPort';
/** Relay-lane port key (replaces the `:8804` constant). */
export const RELAY_PORT_KEY = 'phlix.relayPort';
/** Relay-lane mount-path key (replaces the `/syncplay` segment). */
export const RELAY_PATH_KEY = 'phlix.relayPath';

/** Parse the persisted port value; anything but a bare 1..65535 decimal → null. */
export function parsePortOverride(raw: string | null | undefined): number | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null; // decimals, signs, spaces, words: rejected
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1 || value > 65535) return null;
  return value;
}

/**
 * Parse the persisted mount path; only a clean absolute single-segment-prefix
 * path is accepted (no `//` protocol-relative start, no query/fragment, no
 * whitespace) — else null (default stands).
 */
export function parsePathOverride(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return null;
  if (!/^\/(?!\/)[^\s?#]*$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Read + validate `phlix.syncplayPort` RIGHT NOW (M-TIZEN-07 liveness law:
 * an operator edit takes effect on the next attempt, no rebuild). The single
 * shared reader behind BOTH dial-time consumers — the store's direct-lane
 * `buildWsUrl` and the socketHint seeder (`src/syncplaySocketHint.ts`) — so
 * the sealed bundle and the tizen socket can never disagree on the port.
 * Storage absent/throwing or an invalid row → null → the shipped :8097
 * default decides, byte-identically.
 */
export function syncPlayPortOverride(): number | null {
  try {
    return parsePortOverride(globalThis.localStorage.getItem(SYNCPLAY_PORT_KEY));
  } catch {
    return null; // no storage in this context — the shipped default decides
  }
}
