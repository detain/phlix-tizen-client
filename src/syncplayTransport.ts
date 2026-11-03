/**
 * syncplayTransport — the DIRECT-lane WebSocket URL law, as a leaf module.
 *
 * It lives OUTSIDE `useSyncPlayStore` for one structural reason: the store
 * module pulls pinia/@phlix/ui and is wholesale-mocked in boot tests, while
 * BOTH the store (its own dials) and `src/syncplaySocketHint.ts` (the sealed
 * bundle seam, review M11) must compute the exact same origin. A pure law
 * goes in a pure module — no side effects, no imports beyond the env.
 *
 * The doc-block law text below is relocated VERBATIM from the store (M-TIZEN-
 * 07/12 + carrier law) — read it there in git history unchanged; the store
 * re-exports all of these names for its existing consumers and test pins.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */


// ---- WebSocket URL ---------------------------------------------------------

/**
 * M-TIZEN-12 — the ONLY way a SyncPlay dial may ever use plaintext `ws://`.
 *
 * The direct lane's sibling of {@link HUB_RELAY_INSECURE_DEV_HATCH_ENV}
 * (`src/api/hubRelay.ts`, M-TIZEN-06): a build-time env flag on the repo's
 * default-off convention (same shape as `VITE_PHLIX_TV_ADMIN`), honest in its
 * name — it exists for LOCAL TESTING against a plain-http dev server, and it
 * ships the bearer JWT and every group/playback frame UNENCRYPTED to anyone on
 * the LAN. Never enable it in a release build; README documents it as
 * insecure-dev-only. Kept SEPARATE from the relay hatch on purpose: each
 * bearer transport is opted into plaintext explicitly, never in one blast.
 */
export const SYNCPLAY_INSECURE_DEV_HATCH_ENV = 'VITE_PHLIX_DEV_ALLOW_INSECURE_SYNCPLAY';

/** True only when the dev hatch is explicitly set to `'1'` at build time. */
export function insecureSyncPlayHatchEnabled(): boolean {
  return import.meta.env[SYNCPLAY_INSECURE_DEV_HATCH_ENV] === '1';
}

/**
 * Thrown by {@link buildWsUrl} when a bearer-carrying SyncPlay dial would
 * silently downgrade to plaintext. Named so the connect path can distinguish a
 * POLICY refusal (terminal, actionable — the base must become https) from a
 * transient failure, mirroring `HubRelayInsecureTransportError`.
 */
export class SyncPlayInsecureTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncPlayInsecureTransportError';
  }
}

/**
 * Build the SyncPlay WebSocket URL for a group.
 *
 * The server listens for SyncPlay on port 8097 of the API host (spec §3;
 * `WebSocketServer.php`). The host and the ws/wss scheme are derived from
 * `apiBase` — the TV points at a remote server (and a `.wgt` runs from
 * `file://`), so `window.location` is never a valid source. Only the non-
 * credential room id travels as a query param; the JWT NEVER enters the URL
 * (estate policy WEBSOCKET_URL_QUERY_REFUSED).
 *
 * Carrier law (estate policy WEBSOCKET_URL_QUERY_REFUSED): the bearer JWT is
 * presented via the `Sec-WebSocket-Protocol` header using the TWO-ENTRY form
 * `new WebSocket(url, ['bearer', token])` — a scheme entry plus a separate
 * token entry, serialized as `Sec-WebSocket-Protocol: bearer, <jwt>`. It is
 * NOT the single dotted `['bearer.<jwt>']` shape. With NO token the dial
 * offers nothing at all (second arg `undefined` — the ctor throws on empty
 * protocol entries, HTML spec §3.1 step 9). Same webview, same law:
 * the hub relay (`src/api/hubRelay.ts:453`, `:8804`) has always used it — the
 * in-repo proof the constructor form works on the Tizen platform. Server-side
 * acceptance on `:8097` shipped in phlix-server 424c14d0
 * (`SyncPlayAuthMiddleware::offersBearerSubprotocol()` /
 * `bearerSubprotocolToken()` / `resolveHandshakeToken()`; law doc
 * `docs/dev/WEBSOCKET_AUTH_CARRIERS.md`): the bearer carrier is priority 1
 * (TARGET), the server echoes `Sec-WebSocket-Protocol: bearer` gated on the
 * offer. Transitional note: the legacy `?token=` query carrier is still
 * ACCEPTED server-side (priority 2, RETIRING) while old client builds age
 * out — this client has moved and emits no query token; the token-less
 * `buildWsUrl` signature below makes re-introducing one a type error.
 *
 * Carrier law has a transport half (M-TIZEN-12, review tizen__secnet
 * MAJOR-1): a bearer subprotocol presented over plaintext `ws://` is a
 * LAN-wide credential broadcast — and the join frame that follows rides the
 * replayable SHA-256 group password hash, so even a token-less dial is
 * credential-bearing from its first frame. The scheme therefore only moves
 * UPWARD (`https:` → `wss:`); a non-https base THROWS
 * {@link SyncPlayInsecureTransportError} instead of silently dialing
 * plaintext. This is the {@link HUB_RELAY_INSECURE_DEV_HATCH_ENV} gate
 * (`src/api/hubRelay.ts`, M-TIZEN-06) transposed to the direct lane: same
 * named-error, same default-off build-hatch escape, same per-attempt
 * disclosure — and the same ratified boundary from M-TIZEN-07 still holds
 * (`http:` remains persistable for LAN REST browsing; it is the BEARER DIAL
 * that requires TLS). Exported for tests, mirroring `buildHubRelayUrl`.
 */
export function buildWsUrl(
  apiBase: string,
  roomId: string,
  allowInsecure: boolean = insecureSyncPlayHatchEnabled(),
  portOverride: number | null = null,
): string {
  const origin = syncplaySocketOrigin(apiBase, allowInsecure, portOverride);
  if (!origin) return '';
  return `${origin}?room=${encodeURIComponent(roomId)}`;
}

/**
 * The SCHEME://HOST:PORT half of the direct-lane law, with the `?room=`
 * query removed — exported because the ui v0.99.13 socketHint seam needs
 * exactly this shape (`wsUrl` must carry NO path/query/userinfo; the sealed
 * bundle appends its own `?room=`), and two derivations of one rule drift.
 * Same throws, same defaults, same port-override semantics as
 * {@link buildWsUrl}; an unparsable base yields `''` (callers treat it as
 * "no hint"). Review M11.
 */
export function syncplaySocketOrigin(
  apiBase: string,
  allowInsecure: boolean = insecureSyncPlayHatchEnabled(),
  portOverride: number | null = null,
): string {
  let hostname = '';
  let origin = '';
  let secure: boolean;
  try {
    const url = new URL(apiBase);
    hostname = url.hostname;
    origin = url.origin;
    secure = url.protocol === 'https:';
  } catch {
    // Fail fast: an unparsable apiBase cannot produce a socket URL.
    return '';
  }
  if (!secure && !allowInsecure) {
    throw new SyncPlayInsecureTransportError(
      `SyncPlay dial to ${origin} refused: the :8097 handshake presents a bearer ` +
        `credential, so wss:// is mandatory and a plaintext base would expose the JWT (and ` +
        `the replayable group password hash that follows) to the local network. Configure an ` +
        `https:// server URL; for LOCAL TESTING ONLY you may build with ` +
        `${SYNCPLAY_INSECURE_DEV_HATCH_ENV}=1, which ships SyncPlay over unencrypted ws:// ` +
        `and is never release-safe.`,
    );
  }
  const protocol = secure ? 'wss:' : 'ws:';
  // M-TIZEN-07: `phlix.syncplayPort` moves the PORT only (validated at the
  // reader); the host is by construction the apiBase hostname, so the
  // override can never repoint bearer traffic at a foreign origin.
  return `${protocol}//${hostname}:${portOverride ?? 8097}`;
}
