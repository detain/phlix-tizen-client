/**
 * S529 AD-24 — mDNS-less LAN server discovery for the Tizen TV client.
 *
 * GOAL: help a first-run TV find a phlix server without hand-typing a base URL,
 * while staying ENTIRELY inside the already-granted `internet` privilege —
 * the S503 privilege mask (`app/config.xml` carries ONLY `internet` +
 * `tv.inputdevice`) is honored byte-for-byte: this module adds ZERO privileges
 * and issues NO `tizen.systeminfo` / `webapis` call. Discovery is plain
 * `fetch` against a server's existing, UNAUTHENTICATED health endpoint.
 *
 * PROBE TARGET (re-derived live, CODE WINS): the unauthenticated root health
 * endpoint `GET {base}/health`, answered `{ status:'ok', timestamp, version }`
 * by phlix-server `src/Server/Core/Application.php` `loadRoutes()` — the SAME
 * endpoint `src/bootProbe.ts` reaches through `@phlix/ui`'s `probeServer`. The
 * versioned path that appears in some older findings does NOT exist; probing it
 * would 404 and read as "server absent." Acceptance is deliberately LOOSE
 * (`status === 'ok' || version !== undefined`) so a valid server whose health
 * payload grows/changes fields is still found — mirroring bootProbe's
 * never-hard-assert posture and honoring the "no client hard-assert against a
 * server tuple" law (S276/S279).
 *
 * PRIVILEGE + CORS HONESTY (the honest close, per the S523 "withheld + report"
 * precedent): from a TV webview, a `fetch` to a FOREIGN host's health endpoint
 * is subject to that host's CORS — a server that does not send an
 * `Access-Control-Allow-Origin` we can read yields an opaque network error, NOT
 * a readable `{version}`. A blind full-subnet sweep therefore cannot RELIABLY
 * identify phlix servers under `internet` alone, and would spray hundreds of
 * cross-origin requests from a living-room TV. So the SHIPPED close is a
 * BOUNDED connect-flow suggestion list derived from the addresses this TV
 * already knows (see `resolveConfig.buildConnectSuggestions`), and the same
 * `discoverServers` engine drives any explicit, user-initiated scan. The bounded
 * `sameSubnetCandidates` helper is provided and unit-pinned for that
 * user-initiated path but is deliberately NOT run automatically. The ui
 * Connect-screen "Scan" affordance that surfaces these results is the AD-24
 * surfacing leg (a separate ui train slot) — named honestly, never silently
 * dropped. This step introduces ZERO request sites (the scanner only counts
 * `@phlix/ui` `client.<verb>` / SyncPlay `this.request` shapes; a plain
 * `fetch` to root `health` is neither, and never carries the versioned prefix),
 * so the vendored route manifest stays byte-identical (md5 unchanged) and the
 * era law (no new server routes / no contracts change) holds.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */

/** Verdict of a single host health probe. */
export type HealthProbeError = 'empty' | 'http' | 'shape' | 'network' | 'timeout';

/** Result of probing one candidate base's health endpoint. */
export interface HealthProbeResult {
  /** The canonical base (trailing slash trimmed) this result is for. */
  readonly base: string;
  /** The exact `{base}/health` URL that was requested (or would have been). */
  readonly url: string;
  /** True only when the host answered with a recognizable phlix health body. */
  readonly ok: boolean;
  /** Server version when the body carried one (loose-shape tolerant). */
  readonly version?: string;
  /** Raw `status` field when present (`'ok'` on a healthy server). */
  readonly status?: string;
  /** Failure classification when `ok` is false. */
  readonly error?: HealthProbeError;
}

/** Options for a single health probe. */
export interface ProbeOptions {
  /** Injectable fetch (defaults to the webview's own `fetch`). Test seam. */
  fetchImpl?: typeof fetch;
  /** AbortController deadline in ms. Default {@link DEFAULT_HEALTH_TIMEOUT_MS}. */
  timeoutMs?: number;
}

/** Options for a discovery sweep across candidates. */
export interface DiscoverOptions extends ProbeOptions {
  /** Max concurrent probes. Default {@link DEFAULT_CONCURRENCY}. */
  concurrency?: number;
  /** Fired once per live server as it is confirmed. */
  onServerFound?: (result: HealthProbeResult) => void;
  /** Fired after each probe settles (found or not) to report progress. */
  onProgress?: (done: number, total: number, last: HealthProbeResult) => void;
}

/** ~400 ms per-host budget: a living-room LAN answers a health ping far faster,
 *  and an unreachable address should not stall the sweep. */
export const DEFAULT_HEALTH_TIMEOUT_MS = 400;

/** ~15 parallel probes (survey-d AD-24): enough to sweep a bounded candidate
 *  list briskly, few enough to not saturate a TV network stack. */
export const DEFAULT_CONCURRENCY = 15;

/** Upper bound on how many candidate bases a single sweep will probe, so a
 *  runaway candidate list can never turn into an unbounded request storm. */
export const MAX_CANDIDATES_PER_SWEEP = 64;

/** Canonicalise a base for probing + dedup: trim whitespace and any trailing
 *  slashes so `http://h:8096` and `http://h:8096/` are the SAME host. */
export function normalizeBase(base: string): string {
  return base.trim().replace(/\/+$/, '');
}

/** The exact health URL probed for a base. Empty base → empty string (never
 *  probes root-relative on the app origin). */
export function healthUrl(base: string): string {
  const canonical = normalizeBase(base);
  return canonical ? `${canonical}/health` : '';
}

/**
 * Loose phlix-health body test — REUSES the bootProbe posture: a body is a
 * phlix server when it reports `{status:'ok'}` OR carries a `version`. Never a
 * hard schema assert (the server may add fields; that must not make us blind).
 */
export function isPhlixHealth(body: unknown): boolean {
  if (body === null || typeof body !== 'object') return false;
  const record = body as Record<string, unknown>;
  if (record.status === 'ok') return true;
  return record.version !== undefined;
}

/**
 * Probe ONE candidate's health endpoint. Pure over the injected `fetchImpl`;
 * defaults to the webview's `fetch`. Classifies every failure honestly:
 * - empty base → `error:'empty'`, no network.
 * - non-2xx → `error:'http'`.
 * - 2xx but unrecognized body → `error:'shape'`.
 * - AbortController deadline hit → `error:'timeout'`.
 * - any other rejection (network down, CORS-opaque host) → `error:'network'`.
 *
 * Never rejects: a sweep of unreachable / cross-origin hosts is the NORMAL case
 * on a LAN, so every path resolves to a structured result.
 */
export async function probeHealth(
  base: string,
  options: ProbeOptions = {},
): Promise<HealthProbeResult> {
  const canonical = normalizeBase(base);
  const url = healthUrl(canonical);
  if (!canonical) return { base: '', url: '', ok: false, error: 'empty' };

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return { base: canonical, url, ok: false, error: 'http' };

    const body: unknown = await response.json().catch(() => undefined);
    if (!isPhlixHealth(body)) return { base: canonical, url, ok: false, error: 'shape' };

    const record = (body ?? {}) as Record<string, unknown>;
    return {
      base: canonical,
      url,
      ok: true,
      version: typeof record.version === 'string' ? record.version : undefined,
      status: typeof record.status === 'string' ? record.status : undefined,
    };
  } catch {
    clearTimeout(timer);
    if (timedOut || controller.signal.aborted) {
      return { base: canonical, url, ok: false, error: 'timeout' };
    }
    return { base: canonical, url, ok: false, error: 'network' };
  }
}

/** Stable dedup key for a candidate base: its URL host (hostname+port) when the
 *  value parses, else the normalized string. Two spellings of one machine
 *  (`http://h:8096/` vs `http://h:8096`) collapse to one probe. */
export function hostKey(base: string): string {
  const canonical = normalizeBase(base);
  if (!canonical) return '';
  try {
    return new URL(canonical).host.toLowerCase();
  } catch {
    return canonical.toLowerCase();
  }
}

/**
 * Dedup + bound a candidate list for one sweep: drop empties, collapse by
 * {@link hostKey} (first spelling wins), and cap at `limit` so a caller can
 * never trigger an unbounded request storm.
 */
export function prepareCandidates(bases: readonly string[], limit = MAX_CANDIDATES_PER_SWEEP): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const base of bases) {
    const canonical = normalizeBase(base);
    if (!canonical) continue;
    const key = hostKey(canonical);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(canonical);
    if (out.length >= limit) break;
  }
  return out;
}

/** Pure chunk helper: split `items` into consecutive arrays of at most `size`. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const width = size > 0 ? size : items.length;
  if (width <= 0) return [];
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += width) {
    groups.push(items.slice(i, i + width));
  }
  return groups;
}

/**
 * Sweep candidate bases via bounded-concurrency health probes. Candidates are
 * deduped by host and capped (see {@link prepareCandidates}); each bounded group
 * of up to `concurrency` is probed with `Promise.all`, groups run one after
 * another — so peak in-flight never exceeds `concurrency`. Resolves with EVERY
 * result (found and not) so callers can render a full picture; `onServerFound`
 * fires live for each hit and `onProgress` after each settle.
 */
export async function discoverServers(
  candidates: readonly string[],
  options: DiscoverOptions = {},
): Promise<HealthProbeResult[]> {
  const bounded = prepareCandidates(candidates);
  const total = bounded.length;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const results: HealthProbeResult[] = [];
  let done = 0;

  for (const group of chunk(bounded, concurrency)) {
    const settled = await Promise.all(
      group.map((base) => probeHealth(base, options)),
    );
    for (const result of settled) {
      results.push(result);
      done += 1;
      if (result.ok) options.onServerFound?.(result);
      options.onProgress?.(done, total, result);
    }
  }
  return results;
}

// ── Candidate SOURCES (pure; no systeminfo, no DOM) ─────────────────────────

/**
 * Bounded candidate list from the addresses this TV ALREADY KNOWS — the honest,
 * CORS-defensible default: we only ever probe bases the user themselves
 * configured (and that therefore answer OUR origin). Malformed/duplicate/empty
 * entries are dropped; order is preserved (most-recent-first is the caller's
 * job to arrange). This is the input to the first-run connect suggestion list.
 */
export function buildCandidatesFromHistory(
  history: readonly string[],
  limit = MAX_CANDIDATES_PER_SWEEP,
): string[] {
  return prepareCandidates(history, limit);
}

const PRIVATE_V4 = /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;

/**
 * BOUNDED same-subnet candidate generator for an EXPLICIT, user-initiated scan.
 * Given an IPv4 http(s) base on a private network, yield at most `limit` sibling
 * `scheme://net.<octet>:port` guesses (network .1 first — the usual gateway —
 * then a small deterministic spread) WITHOUT ever leaving `internet`: this only
 * builds URL strings, it does not fetch them.
 *
 * HONEST LIMIT: a blind sweep of these is NOT run automatically. Foreign hosts
 * that omit a readable CORS header answer an opaque network error, so subnet
 * enumeration cannot RELIABLY identify phlix servers under `internet` alone —
 * the shipped default is {@link buildCandidatesFromHistory}. This helper exists
 * so an operator who KNOWS their LAN can opt into a wider (but still capped)
 * sweep from the ui Scan affordance; nothing here calls `tizen.systeminfo` or
 * widens the manifest.
 */
export function sameSubnetCandidates(base: string, limit = 16): string[] {
  const canonical = normalizeBase(base);
  if (!canonical) return [];
  let parsed: URL;
  try {
    parsed = new URL(canonical);
  } catch {
    return [];
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return [];
  const host = parsed.hostname;
  if (!PRIVATE_V4.test(host)) return [];
  const octets = host.split('.');
  if (octets.length !== 4) return [];
  const network = octets.slice(0, 3).join('.');
  const port = parsed.port ? `:${parsed.port}` : '';
  const origin = `${parsed.protocol}//${network}`;
  const out: string[] = [];
  const cap = limit > 0 ? Math.min(limit, 254) : 1;
  for (let i = 1; i <= cap; i += 1) {
    const candidate = `${origin}.${i}${port}`;
    if (normalizeBase(candidate) === canonical) continue; // skip the base itself
    out.push(candidate);
  }
  return out;
}
