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
 * Honest scope, named rather than hidden (RT-058 review): that companion leg has no
 * estate implementation today, and this TV surfaces the six-letter code only — no
 * QR carrying the pairing secret, per `QuickConnectPanel.vue`. The TV half is now
 * contract-true; a pairing that actually COMPLETES still awaits the phone half.
 *
 * Every path literal lives INLINE in a `client.<verb>('…')` call and on an
 * EXISTING served route (the vendored route manifest — 415 tuples, re-vendored
 * byte-identical to contracts #v0.5.6 @ server `58530ec2`, LW-033), so
 * `routeManifest.gate` sees 3 sites / 3 files-1:1 and the fixture stays
 * byte-identical. The `{code}` is a path SEGMENT (`…/quick-connect/{code}/status`),
 * not a query, matching the served template exactly.
 *
 * Wire is snake_case; the app is camelCase. These functions parse at the
 * boundary (Law 2): they accept the small set of documented field aliases the
 * server may emit and hand back ONE trusted internal shape, so the session
 * layer never re-guards nullable wire fields. The pairing SECRET is the
 * exception, deliberately: it has exactly ONE name on the wire (`secret`,
 * QuickConnectController.php:185) and is parsed under that name only — no alias,
 * no fallback, no synthesis. A client that invented a credential the server never
 * issued would not be tolerant, it would be forging one. Response DTOs are minimal
 * because this is the CLIENT half — CODE WINS, the live server owns the full body;
 * we read only what pairing needs and ignore the rest.
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
  /**
   * The short human-code shown on the TV (typed on the companion). A ROUTING
   * identifier — which pairing this is — and never the credential: the server
   * documents a guessed code as revealing "only the state of a pairing the
   * guesser cannot redeem" (`QuickConnectController.php:49-50`).
   */
  readonly code: string;
  /**
   * The 256-bit pairing secret minted beside the code and returned ONCE, to this
   * caller: `QuickConnectController.php:183-187` answers `{code, secret,
   * expiresIn}` and the flow sketch at `:36` is explicit that the secret stays
   * with the TV. THIS is the bearer credential of the redeem — `token()` demands
   * it from the body (`:300-303`) and the store compares it in constant time,
   * burning the pairing on success (`QuickConnectStateStore.php:261`, `:245`).
   * Held by the app, never surfaced: the panel shows `code` alone.
   */
  readonly secret: string;
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
 * logged in yet). The answer is the pairing HANDLE: code AND secret, both
 * required. An initiate that carries no secret is refused here rather than
 * carried forward into a redeem that could never be answered.
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
  // Fail fast, fail loud (Law 4 / RT-058): a code without its secret is a pairing
  // that can NEVER redeem — the server's token() refuses a bodyless secret with 400
  // before it even looks the code up (QuickConnectController.php:302-303). Polling a
  // doomed code to approval only to eat that 400 is the failure this cure closes.
  const secret = pickString(body, ['secret']);
  if (!secret) {
    throw new QuickConnectProtocolError('quick-connect initiate returned no pairing secret');
  }
  const intervalSeconds = pickNumber(body, ['interval', 'poll_interval', 'poll_interval_seconds']);
  const expiresAtSeconds = pickNumber(body, ['expires_at', 'expiresAt']);
  return { code, secret, intervalSeconds, expiresAtSeconds };
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
 * Redeem an APPROVED pairing for this device's token pair. It takes the whole
 * pairing HANDLE, not a bare code: with `secret` a required field of
 * `PairingOffer`, a redeem that forgot the credential is a type error at the call
 * site, not a 400 at runtime (Law 2). A success body missing either token is a
 * protocol error — never a silent empty login.
 *
 * The wire, read off the shipped server rather than assumed: `token()` takes the
 * code from the URL PATH and the pairing secret from the request BODY —
 * `{secret}` — and answers 400 "secret is required" for a body without a
 * non-empty string secret BEFORE it consults the pairing store at all
 * (phlix-server QuickConnectController.php:300-303, consumeApproved only at
 * `:310`). The requirement is original to the feature (S518, server `730e55b7`)
 * and present at this client's pinned era `58530ec2`, so an empty body never
 * redeemed anything, on any version the TV can talk to.
 *
 * Posture ledger (RT-058 cure; review tizen__secnet #2 — this note's earlier
 * wording claimed the opposite and the wire refutes it, so it is replaced, not
 * appended): the SECRET is the bearer credential, the code only routes. What
 * bounds the residual: an observer of the INITIATE RESPONSE sees both halves at
 * once and can race-redeem the instant the companion approves, so the transport
 * posture of that one response is what carries the pairing — the same ratified
 * http-permitted LAN baseline as every other credential call here (see
 * `resolveConfig.ts`). Server-side the credential is not a guess: 32 random bytes
 * as 43-char base64url (`QuickConnectStateStore.php:389-391`, entropy pinned by
 * that suite at `:60-64`), constant-time compared (`:261`), one-shot — a
 * successful exchange deletes the row under the lock that validated it
 * (`QuickConnectController.php:283-286`) — and the whole pairing dies at
 * `TTL_SECONDS = 600` (`QuickConnectStateStore.php:63`). And the claim this cure
 * retires matters in the other direction too: every CODE-ONLY surface — the TV
 * screen, the `{code}/status` poll path, a guessed code answered 404 — carries no
 * credential at all, which is exactly why the server's own law says a guesser
 * "cannot redeem" (`QuickConnectController.php:49-50`).
 */
export async function redeemPairingToken(
  client: PairingTransport,
  offer: PairingOffer,
): Promise<RedeemedTokens> {
  const body = asRecord(
    await client.post(`/api/v1/auth/quick-connect/${encodeURIComponent(offer.code)}/token`, {
      secret: offer.secret,
    }),
  );
  const accessToken = pickString(body, ['access_token', 'accessToken', 'token']);
  const refreshToken = pickString(body, ['refresh_token', 'refreshToken']);
  if (!accessToken || !refreshToken) {
    throw new QuickConnectProtocolError('quick-connect token redeem returned an incomplete token pair');
  }
  return { accessToken, refreshToken };
}
