/**
 * S298 — the hub-relay pending-command consumer (tizen half,
 * `src/api/hubRelay.ts`).
 *
 * Proves the consumer against the REAL hub protocol shapes (re-derived from the
 * hub's `SyncPlayRelayWorker` + `PendingCommandDispatcher`):
 *
 * - URL `ws://<host>:8804/syncplay/{server_id}` — the path the relay's
 *   `onWebSocketConnect()` parses the server id from.
 * - Token on the `Sec-WebSocket-Protocol: bearer, <token>` SUBPROTOCOL — the
 *   only carrier a Tizen webview WebSocket can present (S237 removed the query
 *   string; the relay accepts Authorization OR the bearer subprotocol, and
 *   S355 echoes the negotiated protocol back for strict clients).
 * - Only `pending_command` / `play_media` frames are consumed; every other
 *   frame the relay may send (`group_join`, `playback_play`, `room_state`, …)
 *   is ignored, and garbage yields nothing.
 * - The Tizen additions: the S2a relay-token mint (`mintHubRelayToken`), the
 *   cached minting `tokenProvider` (`createRelayTokenProvider`), and the
 *   boot-time config resolution (`resolveHubRelayConfig`).
 *
 * Only the socket itself is faked (jsdom would otherwise dial `:8804` for
 * real); the frame parsing runs the REAL `parsePendingCommandFrame` and the
 * mint/resolution run the REAL functions with a stubbed fetch.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  openHubRelayConnection,
  closeHubRelayConnection,
  getHubRelaySocket,
  parsePendingCommandFrame,
  buildHubRelayUrl,
  HUB_SYNC_PLAY_PORT,
  mintHubRelayToken,
  createRelayTokenProvider,
  resolveHubRelayConfig,
  type PendingPlayMediaCommand,
} from '@/api/hubRelay';

const SERVER_ID = 'srv-abc123';

// ── the fake socket ───────────────────────────────────────────────────────────

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  static instances: FakeWebSocket[] = [];

  readyState: number = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  closeCalls = 0;

  constructor(
    readonly url: string,
    readonly protocols?: string | string[],
  ) {
    FakeWebSocket.instances.push(this);
  }

  send(): void {}

  close(): void {
    this.closeCalls++;
    this.readyState = FakeWebSocket.CLOSED;
  }

  /** Deliver one server frame as the module's `onmessage` would see it. */
  deliver(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }

  /** Deliver a raw (possibly malformed) body. */
  deliverRaw(data: string): void {
    this.onmessage?.({ data } as MessageEvent);
  }

  connect(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }
}

function socket(): FakeWebSocket {
  const s = FakeWebSocket.instances.at(-1);
  if (!s) throw new Error('no socket was constructed');
  return s;
}

function pendingCommand(over: Partial<PendingPlayMediaCommand> = {}): PendingPlayMediaCommand {
  return {
    type: 'pending_command',
    command: 'play_media',
    serverId: SERVER_ID,
    mediaId: 'media-9',
    title: 'Inception',
    issuedAt: 1_700_000_000,
    source: 'alexa',
    ...over,
  };
}

function config(over: Partial<Parameters<typeof openHubRelayConnection>[0]> = {}) {
  return {
    serverId: SERVER_ID,
    hubBaseUrl: 'http://hub.example.test',
    tokenProvider: () => 'tok-123',
    onPendingCommand: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
});

afterEach(() => {
  // Reset the module-level singleton so the next test starts disconnected.
  closeHubRelayConnection();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ── url construction ──────────────────────────────────────────────────────────

describe('buildHubRelayUrl — the relay URL shape', () => {
  it('dials :8804 with the /syncplay/{server_id} path the relay parses', () => {
    const url = new URL(buildHubRelayUrl('http://hub.example.test', SERVER_ID));
    expect(url.port).toBe(String(HUB_SYNC_PLAY_PORT));
    expect(url.pathname).toBe(`/syncplay/${SERVER_ID}`);
    expect(url.protocol).toBe('ws:');
  });

  it('keeps the RELAY port (8804), never the origin port', () => {
    const url = new URL(buildHubRelayUrl('https://hub.example.test:8443', SERVER_ID));
    expect(url.port).toBe(String(HUB_SYNC_PLAY_PORT));
    expect(url.protocol).toBe('wss:');
  });

  it('encodes the server id in the path', () => {
    const url = new URL(buildHubRelayUrl('http://hub.example.test', 'srv with spaces'));
    expect(url.pathname).toBe('/syncplay/srv%20with%20spaces');
  });
});

// ── frame parsing (the parse boundary) ───────────────────────────────────────

describe('parsePendingCommandFrame — the parse boundary', () => {
  it('parses the hub PendingCommandDispatcher shape', () => {
    const command = parsePendingCommandFrame({
      type: 'pending_command',
      command: 'play_media',
      server_id: SERVER_ID,
      media_id: 'media-9',
      title: 'Inception',
      issued_at: 1_700_000_000,
      source: 'alexa',
    });
    expect(command).toEqual(pendingCommand());
  });

  it('rejects unknown frame types (group_join, playback_*, room_state)', () => {
    expect(parsePendingCommandFrame({ type: 'group_join', group_id: 'g' })).toBeNull();
    expect(parsePendingCommandFrame({ type: 'playback_play' })).toBeNull();
    expect(parsePendingCommandFrame({ type: 'room_state' })).toBeNull();
  });

  it('rejects a pending_command that is not play_media', () => {
    expect(
      parsePendingCommandFrame({ type: 'pending_command', command: 'queue_next' }),
    ).toBeNull();
  });

  it('rejects missing/empty required fields', () => {
    expect(parsePendingCommandFrame(null)).toBeNull();
    expect(parsePendingCommandFrame('garbage')).toBeNull();
    expect(parsePendingCommandFrame({ type: 'pending_command', command: 'play_media' })).toBeNull();
    expect(
      parsePendingCommandFrame({
        type: 'pending_command',
        command: 'play_media',
        server_id: '',
        media_id: 'm',
        title: 'T',
      }),
    ).toBeNull();
    expect(
      parsePendingCommandFrame({
        type: 'pending_command',
        command: 'play_media',
        server_id: SERVER_ID,
        media_id: '',
        title: 'T',
      }),
    ).toBeNull();
    expect(
      parsePendingCommandFrame({
        type: 'pending_command',
        command: 'play_media',
        server_id: SERVER_ID,
        media_id: 'm',
        title: '',
      }),
    ).toBeNull();
  });

  it('falls back issued_at to now when absent and source to unknown', () => {
    const before = Math.floor(Date.now() / 1000);
    const command = parsePendingCommandFrame({
      type: 'pending_command',
      command: 'play_media',
      server_id: SERVER_ID,
      media_id: 'm',
      title: 'T',
    });
    expect(command).not.toBeNull();
    expect(command!.issuedAt).toBeGreaterThanOrEqual(before);
    expect(command!.source).toBe('unknown');
  });
});

// ── relay-token minting (hub S2a endpoint) ───────────────────────────────────

describe('mintHubRelayToken — the hub S2a mint endpoint', () => {
  it('POSTs the hub access JWT and returns the token + expiry', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ token: 'relay-tok', expires_at: 1_700_003_600 }),
    })) as unknown as typeof fetch;
    const minted = await mintHubRelayToken('http://hub.example.test', SERVER_ID, 'hub-jwt', fetchImpl);
    expect(minted).toEqual({ token: 'relay-tok', expiresAt: 1_700_003_600 });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://hub.example.test/api/v1/me/servers/srv-abc123/relay-token',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer hub-jwt' },
      }),
    );
  });

  it('returns null on a non-2xx response', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })) as unknown as typeof fetch;
    expect(await mintHubRelayToken('http://hub.example.test', SERVER_ID, 'hub-jwt', fetchImpl)).toBeNull();
  });

  it('returns null on a network error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    expect(await mintHubRelayToken('http://hub.example.test', SERVER_ID, 'hub-jwt', fetchImpl)).toBeNull();
  });

  it('returns null on a malformed body', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ token: 42 }),
    })) as unknown as typeof fetch;
    expect(await mintHubRelayToken('http://hub.example.test', SERVER_ID, 'hub-jwt', fetchImpl)).toBeNull();
  });
});

// ── cached minting token provider ────────────────────────────────────────────

describe('createRelayTokenProvider — the cached minting provider', () => {
  it('mints on the first call and returns the cached token while unexpired', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ token: 'relay-tok', expires_at: Math.floor(Date.now() / 1000) + 3600 }),
    })) as unknown as typeof fetch;
    const provider = createRelayTokenProvider({
      hubBaseUrl: 'http://hub.example.test',
      serverId: SERVER_ID,
      accessTokenProvider: () => 'hub-jwt',
      fetchImpl,
    });
    // First call kicks off the async mint; the socket layer treats null as
    // "stay closed" and the reconnect ladder re-asks on the next attempt.
    expect(provider()).toBeNull();
    // Once the mint lands, the cached plaintext is returned synchronously.
    await vi.waitFor(() => expect(provider()).toBe('relay-tok'));
    expect(provider()).toBe('relay-tok');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('re-mints once the cached token expires', async () => {
    const now = Math.floor(Date.now() / 1000);
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ token: 'relay-tok', expires_at: now + 5 }),
    })) as unknown as typeof fetch;
    const provider = createRelayTokenProvider({
      hubBaseUrl: 'http://hub.example.test',
      serverId: SERVER_ID,
      accessTokenProvider: () => 'hub-jwt',
      fetchImpl,
    });
    expect(provider()).toBeNull();
    await vi.waitFor(() => expect(provider()).toBe('relay-tok'));
    // Age the cache past expiry by faking the clock; the next call re-mints.
    vi.spyOn(Date, 'now').mockReturnValue((now + 3600) * 1000);
    expect(provider()).toBeNull();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
  });

  it('returns null when no hub access token is available (no mint attempt)', () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const provider = createRelayTokenProvider({
      hubBaseUrl: 'http://hub.example.test',
      serverId: SERVER_ID,
      accessTokenProvider: () => null,
      fetchImpl,
    });
    expect(provider()).toBeNull();
    expect(provider.canRetry()).toBe(false); // no hub session — stay closed
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('canRetry is true while a hub access token exists (a later attempt can succeed)', () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const provider = createRelayTokenProvider({
      hubBaseUrl: 'http://hub.example.test',
      serverId: SERVER_ID,
      accessTokenProvider: () => 'hub-jwt',
      fetchImpl,
    });
    expect(provider.canRetry()).toBe(true);
  });

  it('returns null when the mint fails, and re-tries on the next call', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      return { ok: false, status: 401, json: async () => ({}) };
    }) as unknown as typeof fetch;
    const provider = createRelayTokenProvider({
      hubBaseUrl: 'http://hub.example.test',
      serverId: SERVER_ID,
      accessTokenProvider: () => 'hub-jwt',
      fetchImpl,
    });
    expect(provider()).toBeNull();
    // Once the failed mint releases its flight, a re-ask starts a NEW mint
    // (the provider re-reads the access token and re-attempts the endpoint).
    await vi.waitFor(() => {
      provider();
      expect(calls).toBe(2);
    });
  });
});

// ── boot-time config resolution ──────────────────────────────────────────────

describe('resolveHubRelayConfig — the Tizen boot resolution', () => {
  it('resolves from persisted slots with the server URL as hub-base fallback', () => {
    const resolved = resolveHubRelayConfig({
      serverUrl: 'http://192.168.1.50:8096',
      serverId: SERVER_ID,
      accessTokenProvider: () => 'hub-jwt',
    });
    expect(resolved).not.toBeNull();
    expect(resolved!.serverId).toBe(SERVER_ID);
    expect(resolved!.hubBaseUrl).toBe('http://192.168.1.50:8096');
    expect(typeof resolved!.tokenProvider).toBe('function');
    // The tizen canRetry extension rides along so the connect path can re-ask
    // while a mint is in flight.
    expect(resolved!.canRetryToken?.()).toBe(true);
  });

  it('prefers an explicit hub URL over the server-url fallback', () => {
    const resolved = resolveHubRelayConfig({
      serverUrl: 'http://192.168.1.50:8096',
      hubUrl: 'http://hub.example.test:8800',
      serverId: SERVER_ID,
      accessTokenProvider: () => 'hub-jwt',
    });
    expect(resolved!.hubBaseUrl).toBe('http://hub.example.test:8800');
  });

  it('falls back to build-time env values', () => {
    const resolved = resolveHubRelayConfig({
      serverUrl: 'http://192.168.1.50:8096',
      envHubUrl: 'http://hub-env.test',
      envHubServerId: 'srv-env',
      accessTokenProvider: () => 'hub-jwt',
    });
    expect(resolved!.hubBaseUrl).toBe('http://hub-env.test');
    expect(resolved!.serverId).toBe('srv-env');
  });

  it('returns null with a malformed hub URL — parsed at the config boundary', () => {
    expect(
      resolveHubRelayConfig({
        serverUrl: 'http://192.168.1.50:8096',
        hubUrl: 'not a url',
        serverId: SERVER_ID,
        accessTokenProvider: () => 'hub-jwt',
      }),
    ).toBeNull();
  });

  it('returns null with no hub session (no server id) — nothing opens', () => {
    expect(
      resolveHubRelayConfig({
        serverUrl: 'http://192.168.1.50:8096',
        accessTokenProvider: () => 'hub-jwt',
      }),
    ).toBeNull();
  });

  it('returns null with no hub access token — nothing opens', () => {
    expect(
      resolveHubRelayConfig({
        serverUrl: 'http://192.168.1.50:8096',
        serverId: SERVER_ID,
        accessTokenProvider: () => null,
      }),
    ).toBeNull();
  });
});

// ── lifecycle: open-whenever, rebind, backoff, close ─────────────────────────

describe('openHubRelayConnection — the open-whenever lifecycle', () => {
  it('offers the bearer subprotocol carrier on :8804', () => {
    openHubRelayConnection(config());
    const s = socket();
    expect(s.url).toBe(`ws://hub.example.test:${HUB_SYNC_PLAY_PORT}/syncplay/${SERVER_ID}`);
    expect(s.protocols).toEqual(['bearer', 'tok-123']);
  });

  it('reports open on handshake and delivers pending_command frames', () => {
    const onStatusChange = vi.fn();
    const onPendingCommand = vi.fn();
    openHubRelayConnection(config({ onStatusChange, onPendingCommand }));
    socket().connect();
    expect(onStatusChange).toHaveBeenLastCalledWith('open');

    // The hub writes the SNAKE_CASE PendingCommandDispatcher frame on the wire.
    socket().deliver({
      type: 'pending_command',
      command: 'play_media',
      server_id: SERVER_ID,
      media_id: 'media-9',
      title: 'Inception',
      issued_at: 1_700_000_000,
      source: 'alexa',
    });
    expect(onPendingCommand).toHaveBeenCalledWith(pendingCommand());

    // A second frame still delivers (module-level socket stays open).
    socket().deliver({
      type: 'pending_command',
      command: 'play_media',
      server_id: SERVER_ID,
      media_id: 'media-10',
      title: 'Tenet',
      issued_at: 1_700_000_000,
      source: 'alexa',
    });
    expect(onPendingCommand).toHaveBeenLastCalledWith(pendingCommand({ mediaId: 'media-10', title: 'Tenet' }));
  });

  it('ignores non-pending_command relay frames', () => {
    const onPendingCommand = vi.fn();
    openHubRelayConnection(config({ onPendingCommand }));
    socket().connect();
    socket().deliver({ type: 'group_join', group_id: 'g' });
    socket().deliver({ type: 'playback_play', position: 0 });
    socket().deliver({ type: 'room_state' });
    socket().deliverRaw('not json');
    socket().deliverRaw('{"type":"pending_command"}');
    expect(onPendingCommand).not.toHaveBeenCalled();
  });

  it('a throwing consumer does not kill the message handler', () => {
    const onPendingCommand = vi.fn(() => {
      throw new Error('consumer boom');
    });
    openHubRelayConnection(config({ onPendingCommand }));
    socket().connect();
    socket().deliver({
      type: 'pending_command',
      command: 'play_media',
      server_id: SERVER_ID,
      media_id: 'media-9',
      title: 'Inception',
      issued_at: 1_700_000_000,
      source: 'alexa',
    });
    socket().deliver({
      type: 'pending_command',
      command: 'play_media',
      server_id: SERVER_ID,
      media_id: 'media-11',
      title: 'Interstellar',
      issued_at: 1_700_000_000,
      source: 'alexa',
    });
    expect(onPendingCommand).toHaveBeenCalledTimes(2);
  });

  it('stays closed (no socket, no ladder) when the token provider yields nothing', () => {
    const onStatusChange = vi.fn();
    openHubRelayConnection(config({ tokenProvider: () => null, onStatusChange }));
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(onStatusChange).toHaveBeenLastCalledWith('closed');
  });

  it('re-asks on the ladder while a MINT is in flight — the socket opens once the token lands', async () => {
    vi.useFakeTimers();
    // The tizen token provider mints asynchronously: the first call starts the
    // mint and returns null; once the mint lands, the cached token is returned
    // synchronously. The connect path must NOT dead-end on the null.
    let minted: string | null = null;
    let resolveMint: (token: string | null) => void = () => {};
    const tokenProvider = vi.fn(() => {
      if (minted) return minted;
      void new Promise<string | null>((r) => {
        resolveMint = r;
      }).then((t) => {
        minted = t;
      });
      return null;
    });
    const canRetryToken = () => true;

    openHubRelayConnection(config({ tokenProvider, canRetryToken }));
    expect(FakeWebSocket.instances).toHaveLength(0); // null token — no socket yet

    // The mint lands; the next ladder rung presents the token and opens.
    resolveMint('tok-minted');
    await Promise.resolve(); // flush the mint's cache-write microtask
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    const s = socket();
    expect(s.protocols).toEqual(['bearer', 'tok-minted']);
  });

  it('no hub session (canRetry false): null token → closed, NO ladder, no re-asks', () => {
    vi.useFakeTimers();
    const tokenProvider = vi.fn(() => null);
    const canRetryToken = vi.fn(() => false);
    const onStatusChange = vi.fn();
    openHubRelayConnection(config({ tokenProvider, canRetryToken, onStatusChange }));
    vi.advanceTimersByTime(60_000);
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(tokenProvider).toHaveBeenCalledTimes(1); // never re-asked
    expect(onStatusChange).toHaveBeenLastCalledWith('closed');
  });

  it('a mint that NEVER lands exhausts the capped ladder, then stays closed (no 6th attempt)', () => {
    vi.useFakeTimers();
    // Mint in flight forever: every provider call returns null (canRetry true).
    const tokenProvider = vi.fn(() => null);
    const canRetryToken = () => true;
    const onStatusChange = vi.fn();
    openHubRelayConnection(config({ tokenProvider, canRetryToken, onStatusChange }));
    expect(FakeWebSocket.instances).toHaveLength(0);

    // Rungs 1..5 at 1s,2s,4s,8s,16s — exactly 5 re-asks (the initial + 5).
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(2000);
    vi.advanceTimersByTime(4000);
    vi.advanceTimersByTime(8000);
    vi.advanceTimersByTime(16000);
    expect(tokenProvider).toHaveBeenCalledTimes(6); // 1 initial + 5 rungs

    // Ladder spent — status closed, no further re-asks.
    vi.advanceTimersByTime(60_000);
    expect(tokenProvider).toHaveBeenCalledTimes(6);
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(onStatusChange).toHaveBeenLastCalledWith('closed');
  });

  it('a malformed hub URL with a valid token never throws — laddered, bounded, ends closed', () => {
    vi.useFakeTimers();
    // A hand-built config (bypassing resolveHubRelayConfig's boundary parse)
    // with garbage hubBaseUrl: `new URL()` inside connect throws → ladder.
    const onStatusChange = vi.fn();
    openHubRelayConnection(
      config({ hubBaseUrl: 'not a url', tokenProvider: () => 'tok-123', onStatusChange }),
    );
    expect(FakeWebSocket.instances).toHaveLength(0); // constructor never reached

    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(2000);
    vi.advanceTimersByTime(4000);
    vi.advanceTimersByTime(8000);
    vi.advanceTimersByTime(16000);
    vi.advanceTimersByTime(60_000);

    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(onStatusChange).toHaveBeenLastCalledWith('closed');
    expect(getHubRelaySocket()).toBeNull();
  });

  it('does not duplicate a socket for the same server id', () => {
    openHubRelayConnection(config());
    openHubRelayConnection(config());
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('closes the OLD socket and opens a new one when the server id changes', () => {
    openHubRelayConnection(config());
    const first = socket();
    first.connect();
    openHubRelayConnection(config({ serverId: 'srv-other' }));
    expect(first.closeCalls).toBe(1);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(socket().url).toContain('/syncplay/srv-other');
  });

  it('reconnects with backoff after a drop, capped at 5 attempts', () => {
    vi.useFakeTimers();
    openHubRelayConnection(config());
    const first = socket();
    first.closeCalls = 0;
    first.readyState = FakeWebSocket.CLOSED;
    first.onclose?.();

    // Rung 1 (1s): reconnect attempts 1..5 at 1s,2s,4s,8s,16s.
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    const second = socket();
    second.onclose?.();

    vi.advanceTimersByTime(2000);
    expect(FakeWebSocket.instances).toHaveLength(3);
    socket().onclose?.();

    vi.advanceTimersByTime(4000);
    expect(FakeWebSocket.instances).toHaveLength(4);
    socket().onclose?.();

    vi.advanceTimersByTime(8000);
    expect(FakeWebSocket.instances).toHaveLength(5);
    socket().onclose?.();

    vi.advanceTimersByTime(16000);
    expect(FakeWebSocket.instances).toHaveLength(6);
    socket().onclose?.();

    // Ladder spent — no further sockets, status closed.
    vi.advanceTimersByTime(32000);
    expect(FakeWebSocket.instances).toHaveLength(6);
  });

  it('re-reads the token on every reconnect attempt', () => {
    vi.useFakeTimers();
    const tokenProvider = vi.fn(() => 'tok-1');
    openHubRelayConnection(config({ tokenProvider }));
    expect(tokenProvider).toHaveBeenCalledTimes(1);
    socket().onclose?.();
    vi.advanceTimersByTime(1000);
    expect(tokenProvider).toHaveBeenCalledTimes(2);
  });

  it('closeHubRelayConnection closes the socket, stops the ladder, and clears state', () => {
    vi.useFakeTimers();
    // Open socket: close() is called and the module state is cleared.
    openHubRelayConnection(config());
    const s = socket();
    closeHubRelayConnection();
    expect(s.closeCalls).toBe(1);
    expect(getHubRelaySocket()).toBeNull();

    // Armed ladder after a drop: the timer is cleared, no reconnects happen.
    openHubRelayConnection(config());
    socket().onclose?.();
    closeHubRelayConnection();
    vi.advanceTimersByTime(60_000);
    expect(FakeWebSocket.instances).toHaveLength(2); // only the two opens
  });
});