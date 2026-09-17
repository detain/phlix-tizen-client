/**
 * S520 — Quick-Connect pairing transport (TV / client half).
 *
 * The three HTTP calls the Tizen TV makes to pair WITHOUT typing a password on
 * the remote: ask the server to mint a short code (`initiate`), watch whether a
 * companion has approved it (`status`), then redeem the approved code for the
 * device's own token pair (`token`). Nothing here decides UX or lifecycle — it
 * only turns a request into a promise and a response into the app's internal
 * shape. The companion's `approve` leg (`POST /api/v1/auth/quick-connect/{code}/approve`)
 * is deliberately ABSENT: approving is the phone's job, never the TV's (scope law).
 *
 * Every path literal lives INLINE in a `client.<verb>('…')` call and on an
 * EXISTING served route (the vendored 410-tuple manifest @ server `730e55b7`),
 * so `routeManifest.gate` sees 3 sites / 3 files-1:1 and the fixture stays
 * byte-identical. The `{code}` is a path SEGMENT (`…/quick-connect/{code}/status`),
 * not a query, matching the served template exactly.
 *
 * Wire is snake_case; the app is camelCase. These functions parse at the
 * boundary (Law 2): they accept the small set of documented field aliases the
 * server may emit and hand back ONE trusted internal shape, so the session
 * layer never re-guards nullable wire fields. Response DTOs are minimal because
 * this is the CLIENT half — CODE WINS, the live server owns the full body; we
 * read only what pairing needs and ignore the rest.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

/** The slice of the `@phlix/ui` `ApiClient` this transport actually uses. */
export interface PairingTransport {
  get<T = unknown>(endpoint: string, params?: Record<string, string>, signal?: AbortSignal): Promise<T>;
  post<T = unknown>(endpoint: string, data?: unknown, signal?: AbortSignal): Promise<T>;
}

/** `POST /api/v1/auth/quick-connect/initiate` → the app's internal pairing handle. */
export interface PairingOffer {
  /** The short human-code shown on the TV (typed on the companion). */
  readonly code: string;
  /** Server-published poll cadence in seconds, when it bothers to send one. */
  readonly intervalSeconds: number | null;
  /** Absolute expiry (unix seconds) when the server supplies one; else null. */
  readonly expiresAtSeconds: number | null;
}

/** The state a `…/{code}/status` poll reports, normalised to a closed set. */
export type PairingStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'unknown';

/** `POST …/quick-connect/{code}/token` → the device's freshly-minted token pair. */
export interface RedeemedTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/** Raised when a redeem succeeds at the HTTP layer but the body lacks a token. */
export class QuickConnectProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuickConnectProtocolError';
  }
}

/** Read the first present string among `keys` from a loosely-typed wire body. */
function pickString(body: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

/** Read the first present finite number among `keys`, coercing numeric strings. */
function pickNumber(body: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = body[key];
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** The default poll cadence the TV falls back to when the server sends none. */
export const DEFAULT_POLL_INTERVAL_SECONDS = 5;

/**
 * Ask the server to mint a quick-connect code for this TV. The identity fields
 * are advisory niceties the server may store against the eventual session; the
 * endpoint is public and requires no token (the whole point — you cannot be
 * logged in yet).
 */
export async function initiatePairing(
  client: PairingTransport,
  identity: { deviceName: string; deviceType: string },
): Promise<PairingOffer> {
  const body = asRecord(await client.post('/api/v1/auth/quick-connect/initiate', identity));
  const code = pickString(body, ['code', 'user_code', 'device_code']);
  if (!code) {
    throw new QuickConnectProtocolError('quick-connect initiate returned no code');
  }
  const intervalSeconds = pickNumber(body, ['interval', 'poll_interval', 'poll_interval_seconds']);
  const expiresAtSeconds = pickNumber(body, ['expires_at', 'expiresAt']);
  return { code, intervalSeconds, expiresAtSeconds };
}

/**
 * One poll of a code's approval state. A non-2xx is thrown by `client` (a
 * transient network blip); a 2xx with a shape we do not recognise normalises to
 * `'unknown'` — the caller keeps polling within budget rather than trusting a
 * half-read body.
 */
export async function fetchPairingStatus(client: PairingTransport, code: string): Promise<PairingStatus> {
  const body = asRecord(await client.get(`/api/v1/auth/quick-connect/${encodeURIComponent(code)}/status`));
  const raw = pickString(body, ['status', 'state']);
  switch (raw) {
    case 'pending':
      return 'pending';
    case 'approved':
      return 'approved';
    case 'denied':
      return 'denied';
    case 'expired':
      return 'expired';
    default:
      return 'unknown';
  }
}

/**
 * Redeem an APPROVED code for this device's token pair. The server only answers
 * this for a code it has marked approved; a success body missing either token
 * is a protocol error (never a silent empty login).
 */
export async function redeemPairingToken(client: PairingTransport, code: string): Promise<RedeemedTokens> {
  const body = asRecord(await client.post(`/api/v1/auth/quick-connect/${encodeURIComponent(code)}/token`, {}));
  const accessToken = pickString(body, ['access_token', 'accessToken', 'token']);
  const refreshToken = pickString(body, ['refresh_token', 'refreshToken']);
  if (!accessToken || !refreshToken) {
    throw new QuickConnectProtocolError('quick-connect token redeem returned an incomplete token pair');
  }
  return { accessToken, refreshToken };
}
