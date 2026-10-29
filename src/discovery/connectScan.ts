/**
 * Review tizen__casualgamer M2 — the SURFACING LEG of S529 / AD-24.
 *
 * The client shipped a tested LAN scanner (`discovery/lanDiscovery.ts`) and an
 * address-history suggester (`resolveConfig.buildConnectSuggestions`) with ZERO
 * consumers, so the first-run TV still had to hand-type `http://192.168.x.x:8097`
 * on a D-pad. The vendored `@phlix/ui` v0.99.10 Connect screen carries the
 * host-injection seam they were built for (`PhlixAppConfig.connectScan` — the
 * shipped chunk reads `connectScan ?? null`); this module is the one-line host
 * injection's payload: `main.ts` passes `createConnectScan({…})` into
 * `createPhlixApp`, the page renders a D-pad-operable "Scan" button, rows pick
 * a server, and typed entry stays the collapsed fallback.
 *
 * SCAN SEMANTICS (the S529 privilege-honest close preserved, S503 mask intact):
 * - PRIVILEGES: discovery rides ONLY the granted `internet` privilege — plain
 *   `fetch` GETs of the existing unauthenticated root `/health`. No platform-
 *   info API, no web-API call, `app/config.xml` byte-identical, and the
 *   route-manifest scanner sees ZERO new request sites (a plain fetch is neither
 *   a `client.<verb>` nor a SyncPlay `this.request` shape).
 * - TRIGGER: the scan runs ONLY when the user presses the Connect screen's Scan
 *   button — the EXPLICIT, user-initiated path `sameSubnetCandidates` names.
 *   Nothing sweeps automatically at mount.
 * - BOUNDED: known addresses (capped history ≤ 6) plus a capped same-subnet
 *   sibling sweep (default ≤ 16) from the current base or the most-recent
 *   address; `discoverServers` dedups by host and caps the sweep at
 *   `MAX_CANDIDATES_PER_SWEEP`. A runaway list can never become a request storm.
 * - HONEST ROWS: probed-confirmed servers lead the list (annotated `v<version>`
 *   when the body carried one). A history row that did NOT confirm still shows —
 *   it is an address this TV actually connected to, and a CORS-shy or briefly
 *   sleeping host must not blind the pick-from-list path (the page's own guards
 *   re-validate on row select; "Connect anyway" remains). A subnet GUESS that
 *   did not confirm is never shown — no fabricated IPs, ever.
 * - FAIL LOUD: a storage layer that THROWS rejects the scan; the page's
 *   documented contract turns that into an honest inline "scan failed" note.
 *   Swallowing a broken store into a fake "no servers found" would be a lie.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */

import type { PhlixAppConfig } from '@phlix/ui';
import { buildConnectSuggestions } from '../resolveConfig';
import type { SuggestionStorage } from '../resolveConfig';
import { discoverServers, hostKey, prepareCandidates, sameSubnetCandidates } from './lanDiscovery';
import type { HealthProbeResult } from './lanDiscovery';

/** The ui seam's callback, derived from the config TYPE so the vendored
 *  contract can never drift from this host's usage. (`ConnectCandidate` itself
 *  is not re-exported from the package root — deriving beats guessing.) */
export type ConnectScan = NonNullable<PhlixAppConfig['connectScan']>;
/** One row handed to the Connect screen. */
export type ConnectCandidate = Awaited<ReturnType<ConnectScan>>[number];

/** Everything the scan reads is injected — pure over `storage` + `fetchImpl`. */
export interface ConnectScanDeps {
  /** Storage holding the bounded address history (`phlix.serverHistory`). */
  storage: SuggestionStorage | null;
  /** Reads the current base (`phlix.serverUrl`) — a first-class KNOWN address
   *  (pre-history installs hold it without any history entry) and the
   *  subnet-sweep anchor when set. */
  currentBase: () => string | null;
  /** Test seam forwarded to the probe engine (defaults to the webview fetch). */
  fetchImpl?: typeof fetch;
  /** Bounded sibling budget for the explicit sweep (engine default applies when
   *  omitted — `sameSubnetCandidates` caps at its own parameter default). */
  sweepLimit?: number;
}

/**
 * Pure row assembly. Inputs: the bounded most-recent-first history and the
 * sweep's structured results (which arrive in candidate order). Output:
 * confirmed rows first, then unconfirmed history rows; unconfirmed guesses
 * dropped. Labels carry ONLY server-sent data (the `/health` version), never a
 * UI string — the Connect screen owns every string it renders.
 */
export function assembleConnectCandidates(
  history: readonly string[],
  results: readonly HealthProbeResult[],
): ConnectCandidate[] {
  const historyHosts = new Set(history.map(hostKey));
  const confirmed: ConnectCandidate[] = [];
  const known: ConnectCandidate[] = [];
  for (const result of results) {
    if (result.ok) {
      confirmed.push(
        result.version ? { url: result.base, label: `v${result.version}` } : { url: result.base },
      );
      continue;
    }
    if (historyHosts.has(hostKey(result.base))) known.push({ url: result.base });
  }
  return [...confirmed, ...known];
}

/**
 * Build the `connectScan` callback for `createPhlixApp`. One closure, called
 * per Scan press: read known addresses (persisted base + bounded history) →
 * anchor the sweep → bounded probe → honest rows. Never throws synchronously;
 * async failures (a throwing storage) REJECT by design — the page renders its
 * documented inline failure note.
 */
export function createConnectScan(deps: ConnectScanDeps): ConnectScan {
  return async () => {
    const history = deps.storage ? buildConnectSuggestions(deps.storage) : [];
    const base = deps.currentBase();
    // The persisted base joins the KNOWN set (host-deduped, its spelling wins):
    // a pre-S529 install has a serverUrl but no history, and the reconnect path
    // must still be able to pick the TV's own server from the list.
    const known = base ? prepareCandidates([base, ...history]) : [...history];
    const anchor = base ?? history[0] ?? '';
    const sweep = sameSubnetCandidates(anchor, deps.sweepLimit);
    const results = await discoverServers([...known, ...sweep], {
      fetchImpl: deps.fetchImpl,
    });
    return assembleConnectCandidates(known, results);
  };
}
