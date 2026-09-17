/**
 * Tizen TV client entry point and boot glue.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// Pure, unit-testable resolution of the phlix-ui app mode + apiBase for the
// Samsung Tizen client. Tizen has no hub-config IPC like the Windows/Electron
// client, so this is server-mode only for now — but the function shape mirrors
// the Windows resolveConfig so a hub branch can be added later without churn.

import { buildCandidatesFromHistory } from './discovery/lanDiscovery';

export interface ResolveConfigInput {
  /** Server URL persisted in localStorage (phlix.serverUrl), or null. */
  serverUrl?: string | null;
  /** Build-time fallback (import.meta.env.VITE_PHLIX_SERVER_URL). */
  envUrl?: string | null;
}

export interface ResolvedAppConfig {
  app: 'server' | 'hub';
  apiBase: string;
}

/**
 * Decide which base URL the Tizen client talks to.
 *
 * Server mode only: prefer the persisted direct server URL, then the build-time
 * env URL, then an EMPTY base. The `app: 'hub'` member is part of the shared
 * shape for forward-compatibility but is never returned today.
 *
 * An empty `apiBase` is intentional: the client no longer guesses
 * `localhost:8096` (nothing is listening there on a TV). Instead `main.ts` passes
 * `requireConnection: true`, so an empty base routes the user to the shared
 * `@phlix/ui` first-run Connect screen to enter their server address — which is
 * then persisted (and mirrored back to `localStorage['phlix.serverUrl']`) so it
 * re-seeds here on the next launch.
 */
export function resolveAppConfig(input: ResolveConfigInput): ResolvedAppConfig {
  const apiBase = input.serverUrl ?? input.envUrl ?? '';
  return { app: 'server', apiBase };
}

// ---------------------------------------------------------------------------
// S529 / AD-24 — first-run CONNECT SUGGESTIONS (privilege-honest LAN discovery)
//
// The mDNS-less discovery engine in `discovery/lanDiscovery.ts` can reach a
// real phlix server with a plain `GET {base}/health` (already inside the
// granted `internet` privilege — zero config.xml change per the S503 mask).
// But a blind subnet sweep under `internet`-only is NOT defensible: a TV
// webview cannot enumerate its own subnet without the pruned `systeminfo`
// privilege, and cross-origin `/health` bodies are opaque under CORS, so a
// speculative range scan would fire dozens of pointless requests to machines
// that can never answer honestly. Per the S523 "withheld + reported" precedent
// the shipped close is a BOUNDED suggestion list assembled from the ADDRESSES
// THIS TV has already connected to (the address history) — so first-run
// onboarding offers the D-pad user their known server(s) instead of hand-typing
// a URL. Everything below is pure over an injected storage (no `tizen.*`, no
// `fetch`, no `window`) so it unit-tests in jsdom like `resolveAppConfig`.
// ---------------------------------------------------------------------------

/** localStorage key holding the bounded, most-recent-first server-address history. */
export const SERVER_HISTORY_KEY = 'phlix.serverHistory';
/** How many distinct hosts the connect screen will surface (bounded — no wall of stale IPs). */
export const CONNECT_SUGGESTION_CAP = 6;
/** How many distinct hosts the history retains before the oldest is evicted. */
export const ADDRESS_HISTORY_CAP = 8;

/** Minimal storage shape these helpers need (satisfied by the real `localStorage`). */
export interface SuggestionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * The bounded, deduped (by host) list of addresses this TV has connected to,
 * most-recent-first — the honest stand-in for a subnet sweep. Malformed or
 * absent storage parses to `[]` (never throws: a corrupt history must not
 * reject boot or the connect screen).
 */
export function readAddressHistory(storage: SuggestionStorage | null): string[] {
  const raw = storage ? storage.getItem(SERVER_HISTORY_KEY) : null;
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const entries = parsed.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  // buildCandidatesFromHistory de-dupes by host + caps, preserving order.
  return buildCandidatesFromHistory(entries, ADDRESS_HISTORY_CAP);
}

/**
 * Record a successfully connected server address: prepend it, drop any older
 * entry for the same host (so a re-connect refreshes rather than duplicates),
 * cap, and persist. Fail-soft — a quota/SecurityError here must never reject
 * the `onConnectionChange` callback @phlix/ui invokes mid-interaction (T-09 law).
 */
export function pushAddressHistory(storage: SuggestionStorage | null, url: string): void {
  if (!storage) return;
  const base = url.trim();
  if (!base) return;
  const prior = readAddressHistory(storage);
  const next = buildCandidatesFromHistory([base, ...prior], ADDRESS_HISTORY_CAP);
  try {
    storage.setItem(SERVER_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Persistence failed; this run's in-memory connection still stands.
  }
}

/**
 * Assemble the connect-screen suggestion list from the address history, keeping
 * only the most recent `CONNECT_SUGGESTION_CAP` distinct hosts. Empty history →
 * `[]` (the connect screen simply shows no suggestions — never a fabricated IP).
 */
export function buildConnectSuggestions(storage: SuggestionStorage | null): string[] {
  return readAddressHistory(storage).slice(0, CONNECT_SUGGESTION_CAP);
}
