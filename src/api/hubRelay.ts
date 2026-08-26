/**
 * Hub relay pending-command consumer (S298, tizen half).
 *
 * The ONLY Phlix surface that can receive "Alexa, play X" is the hub's SyncPlay
 * relay WebSocket (`ws://<hub>:8804/syncplay/{server_id}`). This module is the
 * Tizen TV's consumer. It is a faithful port of the proven `@phlix/ui` v0.99.0+
 * consumer (`src/api/hubRelay.ts` in phlix-ui, S298 ui half) adapted to the
 * Tizen boot glue:
 *
 * - **URL** — `ws(s)://<hub-host>:8804/syncplay/<server_id>` (the path the
 *   relay's `onWebSocketConnect()` parses the server id from).
 * - **Token carrier** — the `Sec-WebSocket-Protocol: bearer, <token>`
 *   subprotocol. The relay accepts `Authorization: Bearer` OR the bearer
 *   subprotocol (S237); a browser/TV WebSocket cannot set request headers, so
 *   the subprotocol is the ONLY carrier a Tizen webview can present.
 *   Query-string tokens are refused by design — this module never puts one
 *   there. The relay echoes the negotiated protocol back (S355), which strict
 *   clients require to complete the handshake.
 * - **Relay token source** — the hub's S2a mint endpoint
 *   (`POST /api/v1/me/servers/{server_id}/relay-token`, hub user JWT in the
 *   `Authorization` header). Tizen has no hub-mode UI yet, so the boot glue
 *   resolves the hub context (hub URL, server id, hub access token) from the
 *   app's persisted/env config — see {@link resolveHubRelayConfig}; without a
 *   hub session nothing opens (the honest "no open app" state, mirroring the
 *   roku client's direct-mode behavior).
 * - **Vocabulary** — the relay's own JSON frames (`group_join`, `playback_*`,
 *   `room_state`, `pending_command`, …). ONLY `pending_command` /
 *   `play_media` is consumed here (S93's frame, dispatched by
 *   `PendingCommandDispatcher`); everything else is ignored. The frame is
 *   parsed at this boundary (parse-don't-validate): a typed command comes out,
 *   garbage yields `null` and is dropped.
 * - **Lifecycle** — the socket opens WHENEVER the app is open, not inside a
 *   room join. The hub's `deliverToUser()` deliberately matches on
 *   (user, server) at connect time and does NOT require room membership — the
 *   primary case is a user with no room. Reconnects re-read the token every
 *   attempt because relay tokens expire (1h default); the ladder is capped and
 *   self-terminating.
 *
 * The module holds its connection in module-level state, mirroring
 * `src/api/syncplay.ts` and the ui's `hubRelay.ts`, so the app boots it once
 * via `openHubRelayConnection()` and the store/player react to delivered
 * commands.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */

/** The hub relay's SyncPlay WebSocket port (SyncPlayRelayWorker::DEFAULT_PORT). */
export const HUB_SYNC_PLAY_PORT = 8804;

/** Connection states surfaced via `onStatusChange`. */
export type HubRelayStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

/**
 * One delivered `pending_command` / `play_media` frame (S93's shape, emitted by
 * the hub's `PendingCommandDispatcher`). All fields are already coerced and
 * validated at the parse boundary; `issuedAt` is Unix seconds.
 */
export interface PendingPlayMediaCommand {
  type: 'pending_command';
  command: 'play_media';
  /** Hub server id the media id belongs to (the socket is bound to it). */
  serverId: string;
  /** Media item id to start playing. */
  mediaId: string;
  /** Human-readable title ("Alexa, play X" → X). */
  title: string;
  /** Unix seconds — when the hub dispatched the frame. */
  issuedAt: number;
  /** Frame origin, e.g. `alexa`. */
  source: string;
}

export interface HubRelayConfig {
  /** Server the hub relay socket is bound to (the `/syncplay/{server_id}` path
   *  AND the token's server scope). The media ids in delivered commands belong
   *  to this server. */
  serverId: string;
  /**
   * Returns the hub relay token to present on this (re)connect attempt.
   *
   * Re-read on EVERY attempt because relay tokens are short-lived (1h default);
   * a stale module-level token would fail validation the moment it expires.
   * Returning `null` keeps the socket closed.
   *
   * Tizen extension (`canRetry`): the tizen token provider MINTS asynchronously
   * (S2a HTTP round trip), so its first call after a mint starts returns
   * `null` while the mint is in flight. `canRetry()` distinguishes "nothing to
   * present, but a later attempt may succeed" (mint pending / re-mintable)
   * from "no hub session at all" (no access token — stay closed, no ladder).
   */
  tokenProvider: () => string | null;
  /** Tizen extension — see {@link HubRelayConfig.tokenProvider}. */
  canRetryToken?: () => boolean;
  /**
   * Hub base origin, e.g. `http://192.168.1.50:8800`. The relay listens on port
   * 8804 regardless of this origin's own port. Tizen has no same-origin layout
   * (the app runs from `file://`), so the boot glue ALWAYS supplies this —
   * see {@link resolveHubRelayConfig}.
   */
  hubBaseUrl: string;
  /** Called once per delivered `pending_command` / `play_media` frame. */
  onPendingCommand: (command: PendingPlayMediaCommand) => void;
  /** Optional lifecycle visibility (e.g. a "connected to hub" indicator). */
  onStatusChange?: (status: HubRelayStatus) => void;
}

/** Maximum reconnect attempts before giving up (mirrors the SyncPlay socket). */
const MAX_RECONNECT_ATTEMPTS = 5;

/** Base delay in ms for the exponential backoff ladder. */
const RECONNECT_BASE_DELAY_MS = 1000;

/**
 * Coerce one raw relay frame into a typed play-media command.
 *
 * The parse boundary: the hub's `PendingCommandDispatcher` emits
 * `{type:'pending_command', command:'play_media', server_id, media_id, title,
 * issued_at, source}` — this validates that shape and coerces numbers at the
 * edge; anything else (unknown frame types, malformed bodies) returns `null`
 * and is dropped. Exported for tests and for consumers that want to parse a
 * frame without opening a socket.
 */
export function parsePendingCommandFrame(raw: unknown): PendingPlayMediaCommand | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const frame = raw as Record<string, unknown>;
  if (frame.type !== 'pending_command' || frame.command !== 'play_media') return null;
  if (typeof frame.server_id !== 'string' || frame.server_id === '') return null;
  if (typeof frame.media_id !== 'string' || frame.media_id === '') return null;
  if (typeof frame.title !== 'string' || frame.title === '') return null;
  const issuedAt =
    typeof frame.issued_at === 'number' && Number.isFinite(frame.issued_at)
      ? frame.issued_at
      : Math.floor(Date.now() / 1000);
  return {
    type: 'pending_command',
    command: 'play_media',
    serverId: frame.server_id,
    mediaId: frame.media_id,
    title: frame.title,
    issuedAt,
    source: typeof frame.source === 'string' ? frame.source : 'unknown',
  };
}

/**
 * Build the relay URL: `ws(s)://<host>:8804/syncplay/<server_id>`.
 *
 * The scheme follows `hubBaseUrl` (`https:` → `wss:`); the port is the relay's
 * own 8804, never the origin's. Exported for tests.
 */
export function buildHubRelayUrl(hubBaseUrl: string, serverId: string): string {
  const host = new URL(hubBaseUrl).hostname;
  const scheme = new URL(hubBaseUrl).protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${host}:${HUB_SYNC_PLAY_PORT}/syncplay/${encodeURIComponent(serverId)}`;
}

// ── relay-token minting (hub S2a endpoint) ───────────────────────────────────

export interface MintedRelayToken {
  /** Plaintext relay token (returned exactly once at mint time). */
  token: string;
  /** Unix seconds when the token expires. */
  expiresAt: number;
}

/**
 * Mint a per-user, server-scoped relay token from the hub (S2a).
 *
 * `POST {hubBaseUrl}/api/v1/me/servers/{serverId}/relay-token` with the hub
 * access JWT in the `Authorization` header. Returns `null` on any failure
 * (non-2xx, network error, malformed body) — the caller degrades to "socket
 * stays closed" rather than presenting a bad credential.
 */
export async function mintHubRelayToken(
  hubBaseUrl: string,
  serverId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MintedRelayToken | null> {
  let response: Response;
  try {
    response = await fetchImpl(`${hubBaseUrl.replace(/\/+$/, '')}/api/v1/me/servers/${encodeURIComponent(serverId)}/relay-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  try {
    const body = (await response.json()) as { token?: unknown; expires_at?: unknown };
    if (typeof body.token !== 'string' || body.token === '') return null;
    const expiresAt =
      typeof body.expires_at === 'number' && Number.isFinite(body.expires_at)
        ? body.expires_at
        : Math.floor(Date.now() / 1000) + 3600;
    return { token: body.token, expiresAt };
  } catch {
    return null;
  }
}

export interface RelayTokenProviderInput {
  /** Hub base origin the mint endpoint lives on (same as the socket's hub). */
  hubBaseUrl: string;
  /** Hub server id the token is scoped to. */
  serverId: string;
  /** Supplies the hub ACCESS JWT (the hub user's session credential). */
  accessTokenProvider: () => string | null;
  /** Test seam — defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Build the ui-contract `tokenProvider` for Tizen: a cached minting provider.
 *
 * Reconnects re-read the provider (relay tokens expire hourly). The provider
 * returns the cached plaintext while it is unexpired, re-mints once expired or
 * missing, and returns `null` while a mint is in flight or after a mint
 * failure. `canRetry()` — the tizen extension the connect path consults — is
 * `true` whenever a hub access token exists (a later attempt can succeed:
 * the mint may land, or an expired token may be re-minted) and `false` when
 * there is no hub session at all (the socket stays closed, honest "no open
 * app" state, no ladder). The mint is single-flighted: concurrent reconnect
 * attempts share one mint.
 */
export function createRelayTokenProvider(
  input: RelayTokenProviderInput,
): { (): string | null; canRetry: () => boolean } {
  let cached: MintedRelayToken | null = null;
  let minting: Promise<MintedRelayToken | null> | null = null;

  const provider = (): string | null => {
    const now = Math.floor(Date.now() / 1000);
    if (cached && cached.expiresAt > now) return cached.token;

    const accessToken = input.accessTokenProvider();
    if (!accessToken) return null;

    if (!minting) {
      minting = mintHubRelayToken(input.hubBaseUrl, input.serverId, accessToken, input.fetchImpl).then(
        (minted) => {
          minting = null;
          if (minted) cached = minted;
          return minted;
        },
        () => {
          minting = null;
          return null;
        },
      );
    }
    // The mint is async; the socket layer treats a `null` token as "not yet
    // present" and — via `canRetry` — re-asks on the reconnect ladder.
    return null;
  };
  provider.canRetry = () => input.accessTokenProvider() !== null;

  return provider;
}

// ── boot-time config resolution ──────────────────────────────────────────────

export interface HubRelayConfigInput {
  /** The app's server URL (`phlix.serverUrl` / env seed — the only host the
   *  TV knows). Used as the hub-base fallback in the common self-hosted
   *  layout where the hub shares the server's host. */
  serverUrl: string;
  /** Explicit hub origin (persisted `phlix.hubUrl`), wins over the fallback. */
  hubUrl?: string | null;
  /** Hub server UUID (persisted `phlix.hubServerId` or build env). */
  serverId?: string | null;
  /** Supplies the hub access JWT (persisted `phlix.hubAccessToken` — written
   *  by a future hub-mode session; absent today → nothing opens). */
  accessTokenProvider: () => string | null;
  /** Build-time env values (VITE_PHLIX_HUB_URL / VITE_PHLIX_HUB_SERVER_ID). */
  envHubUrl?: string | null;
  envHubServerId?: string | null;
  /** Test seam — defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Resolve the hub-relay consumer config for the Tizen boot, or `null`.
 *
 * Tizen is server-mode only today (no hub-mode UI — S353 resolveConfig), so
 * the hub context is resolved from the same kind of persisted/env slots the
 * app already uses for its server URL. When no hub server id is known — the
 * case today — the consumer stays closed: "Alexa, play X" degrades to the
 * hub's honest "no open app" answer until a hub session exists, exactly like
 * the roku client's direct mode.
 *
 * Hub base precedence: persisted `phlix.hubUrl` → build env
 * `VITE_PHLIX_HUB_URL` → the server URL's origin (the common self-hosted
 * layout where the hub shares the server's host — the web ui's own-origin
 * default, transposed to the only host a TV knows).
 */
export function resolveHubRelayConfig(
  input: HubRelayConfigInput,
): Omit<HubRelayConfig, 'onPendingCommand' | 'onStatusChange'> | null {
  const serverId = input.serverId ?? input.envHubServerId ?? null;
  if (!serverId) return null;
  const accessToken = input.accessTokenProvider();
  if (!accessToken) return null;

  const hubUrl = input.hubUrl ?? input.envHubUrl ?? input.serverUrl;
  if (!hubUrl) return null;
  // Parse at the boundary: a malformed hub URL (user-editable localStorage
  // slot) can never produce a relay socket — resolve to nothing instead of
  // letting a later `new URL()` throw during boot.
  try {
    new URL(hubUrl);
  } catch {
    return null;
  }

  const tokenProvider = createRelayTokenProvider({
    hubBaseUrl: hubUrl,
    serverId,
    accessTokenProvider: input.accessTokenProvider,
    fetchImpl: input.fetchImpl,
  });
  return {
    serverId,
    hubBaseUrl: hubUrl,
    tokenProvider,
    canRetryToken: tokenProvider.canRetry,
  };
}

// ── module-level connection state (mirrors ui hubRelay.ts) ───────────────────

let hubWs: WebSocket | null = null;
let hubConfig: HubRelayConfig | null = null;
let hubReconnectAttempts = 0;
let hubReconnectTimer: ReturnType<typeof setTimeout> | null = null;

function setStatus(status: HubRelayStatus): void {
  hubConfig?.onStatusChange?.(status);
}

/**
 * Open the hub relay socket (or return the open one).
 *
 * The "open-whenever" lifecycle: this is NOT gated on a SyncPlay room join —
 * the hub delivers `pending_command` to an authenticated (user, server) socket
 * regardless of room membership, and the primary "Alexa, play X" case has no
 * room at all. Call once at app boot (see `main.ts`); the socket stays open
 * with a capped reconnect ladder until {@link closeHubRelayConnection}.
 *
 * If the token provider yields nothing, the socket stays closed (`closed`
 * status) and no reconnect ladder is armed — the caller re-invokes after hub
 * auth is available.
 */
export function openHubRelayConnection(config: HubRelayConfig): void {
  if (hubWs && hubConfig?.serverId === config.serverId) return;
  // A DIFFERENT server id means the app re-pointed at another server (native
  // clients switch servers at runtime). The old socket is bound to the old
  // server and its onmessage closure reads the module-level hubConfig — leaving
  // it open would deliver the new config's frames to the old socket and leak it.
  if (hubWs) {
    hubWs.onclose = null;
    hubWs.close();
    hubWs = null;
  }
  hubConfig = config;
  if (hubReconnectTimer !== null) {
    clearTimeout(hubReconnectTimer);
    hubReconnectTimer = null;
  }
  connectHubRelaySocket();
}

/**
 * Connect (or reconnect) the hub relay socket with the current token.
 *
 * Deliberately NOT the caller-initiated entry point — the reconnect timer must
 * not reset the backoff budget it is computed from (S283 lesson, same module
 * pattern as `connectSyncPlaySocket`).
 */
function connectHubRelaySocket(): void {
  if (!hubConfig) return;
  setStatus(hubReconnectAttempts > 0 ? 'reconnecting' : 'connecting');
  const token = hubConfig.tokenProvider();
  if (!token) {
    // No token to present. The tizen token provider MINTS asynchronously
    // (S2a HTTP round trip): its first call after a mint starts returns null
    // while the mint is in flight. When a hub access token exists, a later
    // attempt can succeed — re-ask on the bounded reconnect ladder (the mint
    // usually lands within the first rung). Without a hub session at all,
    // stay closed with no ladder (the honest "no open app" state).
    if (hubConfig.canRetryToken?.() === true) {
      scheduleHubReconnect();
    } else {
      setStatus('closed');
    }
    return;
  }

  let socket: WebSocket;
  try {
    // The token travels in the `bearer, <token>` SUBPROTOCOL — the only carrier
    // a Tizen webview WebSocket can present (S237: query-string refused by
    // design). The relay echoes it back (S355), completing the handshake.
    socket = new WebSocket(buildHubRelayUrl(hubConfig.hubBaseUrl, hubConfig.serverId), ['bearer', token]);
  } catch {
    // A malformed persisted hub URL (user-editable localStorage slot) or a
    // WebSocket constructor failure must not crash boot — ladder it (bounded).
    scheduleHubReconnect();
    return;
  }
  hubWs = socket;

  socket.onopen = () => {
    hubReconnectAttempts = 0;
    setStatus('open');
  };

  socket.onmessage = (event: MessageEvent) => {
    if (!hubConfig) return;
    let raw: unknown;
    try {
      raw = JSON.parse(event.data as string);
    } catch {
      return; // malformed frame — ignore
    }
    const command = parsePendingCommandFrame(raw);
    if (!command) return;
    try {
      hubConfig.onPendingCommand(command);
    } catch {
      // A throwing consumer must not kill the socket's message handler; the
      // hub keeps the connection either way.
    }
  };

  socket.onclose = () => {
    hubWs = null;
    scheduleHubReconnect();
  };

  socket.onerror = () => {
    // `onclose` follows `onerror` for a failed socket; the ladder lives there.
  };
}

function scheduleHubReconnect(): void {
  if (!hubConfig || hubWs !== null) return;
  if (hubReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    setStatus('closed');
    hubReconnectAttempts = 0;
    return;
  }
  const delay = RECONNECT_BASE_DELAY_MS * 2 ** hubReconnectAttempts;
  hubReconnectAttempts++;
  setStatus('reconnecting');
  hubReconnectTimer = setTimeout(() => {
    hubReconnectTimer = null;
    connectHubRelaySocket();
  }, delay);
}

/**
 * Close the hub relay socket and stop the reconnect ladder.
 */
export function closeHubRelayConnection(): void {
  if (hubReconnectTimer !== null) {
    clearTimeout(hubReconnectTimer);
    hubReconnectTimer = null;
  }
  if (hubWs) {
    hubWs.onclose = null;
    hubWs.close();
    hubWs = null;
  }
  hubReconnectAttempts = 0;
  hubConfig = null;
  setStatus('closed');
}

/** The open socket, or null. Exported for the app's status UI / tests. */
export function getHubRelaySocket(): WebSocket | null {
  return hubWs;
}
