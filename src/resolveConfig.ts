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

// ---------------------------------------------------------------------------
// M-TIZEN-07 — SCHEME ALLOW-LIST AT THE STORAGE BOUNDARY (parse, don't trust)
//
// The persisted server/hub address is the strongest credential-carrying string
// in the app: every API call against the base it yields rides the
// `Authorization: Bearer` header, and the first-run Connect screen re-seeds
// from it. Before this cure, `phlix.serverUrl` / `phlix.serverHistory` were
// written verbatim and read verbatim — an entry like `javascript:…` or
// `data:…` stored once (evil-twin Connect suggestion, hand-edited localStorage,
// a future ui-side accept) was trusted forever.
//
// The law now: an ABSOLUTE URL (one `new URL()` accepts) may only persist and
// only resolve when its parsed protocol is `http:` or `https:`. The URL parser
// — not a regex — is the arbiter, so the scheme-case games (`JavaScript:`),
// the leading/trailing-space tricks, and the embedded-tab/CR tricks the WHATWG
// parser itself normalizes all classify honestly (protocol comes back
// lowercased and whitespace-stripped; `java\tscript:` parses as `javascript:`
// and is refused). Strings `new URL()` REJECTS are not absolute URLs at all:
// relative bases and scheme-less text keep their existing pass-through
// semantics (they cannot carry a foreign origin — fetch resolves them against
// the app's own `file://` page origin, where non-http(s) targets are inert).
//
// Enforcement is at BOTH edges of the boundary: writes refuse the poison and
// reads sanitize legacy-poisoned persisted values (the stored-forever class),
// so a pre-cure install heals on its next connect. This composes with (never
// replaces) the M-TIZEN-06 relay TLS law: `http:` stays persistable for LAN
// servers; the bearer-carrying relay DIAL still additionally requires `https:`
// in `api/hubRelay.ts`, untouched.
// ---------------------------------------------------------------------------

/** The ONLY protocols a persisted/resolved server address may carry. */
const ALLOWED_ADDRESS_PROTOCOLS: readonly string[] = ['http:', 'https:'];

/**
 * Storage-boundary scheme gate for one address string. `true` = acceptable
 * (http(s) absolute URL, blank, or non-absolute text whose existing semantics
 * are preserved); `false` = absolute URL with a disallowed scheme
 * (`javascript:`, `data:`, `file:`, `ws:` raw, …) — refuse at the edge.
 */
export function isAllowedServerAddress(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Not an absolute URL (relative base, bare host:port, garbage) — the
    // existing pass-through semantics, untouched by this cure.
    return true;
  }
  return ALLOWED_ADDRESS_PROTOCOLS.includes(parsed.protocol);
}

/**
 * Sanitize one address slot read: trims an acceptable value, maps a
 * non-http(s) absolute scheme to `null` (as good as unset — the caller's
 * existing `??` chain then falls back exactly as it does for absent storage).
 */
export function sanitizeServerAddress(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (!isAllowedServerAddress(trimmed)) return null;
  return trimmed;
}

// ---------------------------------------------------------------------------
// M-TIZEN-12 r2 — SCHEME GATE AT THE RESOLVE BOUNDARY (review tizen__secnet
// M12r2). The M-TIZEN-07 allow-list above CLASSIFIES schemes (http/https
// survive, `javascript:`/`data:` are poison); it never asked whether the
// SURVIVING base is about to present CREDENTIAL traffic. r1 (39f4c7a) gated
// the :8097 dial itself, but the boundary kept resolving a persisted
// `http://`-literal serverUrl verbatim and `main.ts` handed that plaintext
// base straight to the credential-transport consumers (the hub-relay
// server-origin fallback today, any bearer consumer tomorrow) — a refusal
// living ONLY at one dial is one new caller away from leaking again. The law
// now reads from the edge it guards: `resolveCredentialBase` is the resolve
// boundary FOR HUB/CREDENTIAL TRAFFIC. It reuses the M-TIZEN-07 read
// sanitize (the legacy-poisoned class falls back as for an absent slot),
// then REFUSES an absolute `http:` base with the named
// {@link CredentialTransportInsecureError} — refusal with an honest error is
// the ratified estate posture (the e4d8516 gate idiom: `buildHubRelayUrl`
// throws, it never silently upgrades; scheme moves UPWARD only). Blank,
// absent, and non-absolute values keep their existing pass-through
// semantics — the builders' own parse-bail still governs what `new URL()`
// rejects. The M-TIZEN-07 persistence law is NOT re-litigated: `http:`
// remains persistable for LAN REST browsing via `resolveAppConfig`, which is
// unchanged; only credential traffic is gated here. The consumer's dev hatch
// (`allowInsecure`, threaded by callers from their OWN documented
// VITE_PHLIX_DEV_ALLOW_INSECURE_* flag) relaxes the boundary ONLY so the
// dial-side per-attempt disclosure keeps firing — no third flag exists.
// ---------------------------------------------------------------------------

/** Named boundary refusal for a plaintext base about to carry credentials. */
export class CredentialTransportInsecureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialTransportInsecureError';
  }
}

/**
 * The ONE scheme predicate the credential-transport law reads from: `true`
 * iff `raw` (after WHATWG trim/case-normalize) parses as an ABSOLUTE URL with
 * protocol `http:`. Non-absolute text, https, and every non-http scheme are
 * `false` here for different reasons — those stay governed by the edges that
 * already refuse them (the M-TIZEN-07 allow-list for poison schemes, the
 * builders' own parse/guard for raw `ws:` and relatives).
 */
export function isPlaintextCredentialBase(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    return new URL(trimmed).protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Resolve the base for HUB/CREDENTIAL traffic (bearer dials, relay-token
 * mints — anything presenting the JWT or the group password hash).
 * Precedence and read-sanitize are IDENTICAL to {@link resolveAppConfig};
 * the delta is the scheme gate: a surviving absolute `http:` base is REFUSED
 * unless the caller threads its own dev hatch. Returns `''` for the
 * nothing-resolved case exactly like `resolveAppConfig` (the Connect gate /
 * resolvers' own blank handling then owns it).
 */
export function resolveCredentialBase(
  input: ResolveConfigInput,
  allowInsecure = false,
): string {
  const serverUrl = sanitizeServerAddress(input.serverUrl);
  const base = serverUrl ?? input.envUrl ?? '';
  if (!allowInsecure && isPlaintextCredentialBase(base)) {
    // The predicate just parsed successfully; the second parse is for the
    // honest origin in the message and cannot realistically disagree.
    let origin = base;
    try {
      origin = new URL(base.trim()).origin;
    } catch {
      /* keep the raw text if the platform parser disagrees with itself */
    }
    throw new CredentialTransportInsecureError(
      `Credential transport base ${origin} refused at the resolve boundary: a persisted ` +
        `http:// server URL must never present hub/credential traffic in plaintext. ` +
        `Configure an https:// server URL (http:// stays valid for LAN browsing per ` +
        `the M-TIZEN-07 boundary law). For LOCAL TESTING ONLY the consumer's ` +
        `VITE_PHLIX_DEV_ALLOW_INSECURE_* hatch (exactly '1') relaxes this gate — it ` +
        `ships credentials unencrypted and is never release-safe.`,
    );
  }
  return base;
}

/**
 * Decide which base URL the Tizen client talks to.
 *
 * Server mode only: prefer the persisted direct server URL, then the build-time
 * env URL, then an EMPTY base. The `app: 'hub'` member is part of the shared
 * shape for forward-compatibility but is never returned today.
 *
 * M-TIZEN-07: the persisted slot passes the storage-boundary gate HERE (the
 * defensive-normalization edge) — a legacy-poisoned `phlix.serverUrl`
 * resolves as unset, i.e. down to the env URL or the empty base (→ the Connect
 * screen re-asks) instead of riding the bearer credential to a `javascript:`
 * /`data:` "origin". The build-time `envUrl` is compile-time input, not
 * user-editable storage, and keeps its verbatim pass-through.
 *
 * An empty `apiBase` is intentional: the client no longer guesses
 * `localhost:8096` (nothing is listening there on a TV). Instead `main.ts` passes
 * `requireConnection: true`, so an empty base routes the user to the shared
 * `@phlix/ui` first-run Connect screen to enter their server address — which is
 * then persisted (and mirrored back to `localStorage['phlix.serverUrl']`) so it
 * re-seeds here on the next launch.
 */
export function resolveAppConfig(input: ResolveConfigInput): ResolvedAppConfig {
  const serverUrl = sanitizeServerAddress(input.serverUrl);
  const apiBase = serverUrl ?? input.envUrl ?? '';
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
 * reject boot or the connect screen). M-TIZEN-07: entries that are absolute
 * URLs with a non-http(s) scheme (the legacy-poisoned class — stored before
 * the write gate existed) are sanitized OUT of the read, so the suggestion
 * rail and every discovery probe can never carry them; the next successful
 * connect rewrites storage through this same filter and heals the slot.
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
  const entries = parsed.filter(
    (v): v is string => typeof v === 'string' && v.trim() !== '' && isAllowedServerAddress(v),
  );
  // buildCandidatesFromHistory de-dupes by host + caps, preserving order.
  return buildCandidatesFromHistory(entries, ADDRESS_HISTORY_CAP);
}

/**
 * Record a successfully connected server address: prepend it, drop any older
 * entry for the same host (so a re-connect refreshes rather than duplicates),
 * cap, and persist. M-TIZEN-07: the address passes the storage-boundary gate
 * FIRST — a non-http(s) absolute scheme (and blanks, as always) are refused
 * and nothing is written. Fail-soft — a quota/SecurityError here must never
 * reject the `onConnectionChange` callback @phlix/ui invokes mid-interaction
 * (T-09 law).
 */
export function pushAddressHistory(storage: SuggestionStorage | null, url: string): void {
  if (!storage) return;
  const base = sanitizeServerAddress(url);
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
