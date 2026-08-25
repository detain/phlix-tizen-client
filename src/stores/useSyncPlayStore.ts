/**
 * SyncPlay collaborative playback state management with WebSocket support.
 *
 * Manages the current SyncPlay group session, member list, playback
 * synchronization state, and real-time WebSocket communication for the local user.
 *
 * This store re-implements the @phlix/ui v0.99.0 SyncPlay surface locally:
 * `@phlix/ui` does not export its player-side SyncPlay API (`getSyncPlayApi`,
 * `openSyncPlayConnection`, `sendSyncPlayCommand` are internal to the package),
 * so the REST client and the WebSocket layer live here, typed against
 * `@phlix/contracts` v0.4.3 (SyncPlayGroup / SyncPlaySession / SyncPlayUser)
 * and framed by `@phlix/syncplay` v0.1.2.
 *
 * Wire contract (authority: phlix-syncplay/SPEC.md):
 *   - HTTP surface is exactly five routes under `/api/v1/syncplay/groups`
 *     (list / create / get / join / leave). There is no `/rooms`, no
 *     `/sessions/{id}/command` and no `/members` route (S276) — the group IS
 *     the session, and members ride inside the group state.
 *   - Playback transport is the WebSocket on `:8097` (`syncplay_*` frames).
 *   - All field names are snake_case; positions/durations are MILLISECONDS
 *     (SPEC.md:91). The store applies wire positions verbatim on receive and
 *     on state adoption (S293: receive side untouched); only the `sendCommand`
 *     position input is SECONDS, converted to ms at the send boundary.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  SyncPlayGroup,
  SyncPlaySession,
  SyncPlayUser,
  SyncPlayMember,
  SyncPlayPlaybackCommand,
} from '@phlix/contracts';
import { SyncPlayClient, serializeMessage } from '@phlix/syncplay';

// ---- Types -----------------------------------------------------------------

/**
 * Input for creating a new SyncPlay group.
 *
 * Forwarded verbatim to POST /api/v1/syncplay/groups; the server reads only
 * `name` (plus `password`/`memberId`/`memberName` when supplied). `description`
 * and `isPublic` have NO server counterpart (S285) — kept because they are part
 * of the form model, but discarded on arrival.
 */
interface CreateRoomInput {
  name: string;
  description?: string;
  isPublic: boolean;
}

/**
 * One group as the server actually puts it on the wire — `GroupState::getState()`
 * verbatim (snake_case, `members` as a DICTIONARY keyed by member id) plus the
 * reduced listing shape (`id`/`name`, no `members`). Every field is optional
 * because the two shapes overlap only partially.
 *
 * There is no `session` envelope and no camelCase anywhere in the SyncPlay REST
 * contract; the raw shape is named honestly here and mapped by
 * {@link groupToSession}.
 */
interface RawSyncPlayGroup {
  group_id?: string;
  group_name?: string;
  /** Listing rows use the short spelling. */
  id?: string;
  name?: string;
  member_count?: number;
  /** Dict keyed by member id from `getState()`; `[]` from the raw-snapshot fallback. */
  members?: Record<string, RawSyncPlayMember> | RawSyncPlayMember[];
  host_id?: string | null;
  has_password?: boolean;
  current_media_id?: string | null;
  current_media_duration?: number | null;
  playback_position?: number;
  /** `playing` | `paused` | `buffering` | `stopped` (GroupState::STATE_*). */
  playback_state?: string;
  is_playing?: boolean;
  queue?: unknown[];
  /** Unix seconds. */
  created_at?: number;
  /** Unix seconds. */
  last_activity_at?: number;
}

/** One member inside {@link RawSyncPlayGroup.members}. */
interface RawSyncPlayMember {
  id?: string;
  name?: string;
  is_host?: boolean;
  /** Unix seconds. */
  joined_at?: number;
}

/** `{ group }` — returned by create / get / join. */
interface SyncPlayGroupResponse {
  group?: RawSyncPlayGroup;
}

/** `{ groups }` — returned by the group listing. */
interface SyncPlayGroupsResponse {
  groups?: RawSyncPlayGroup[];
}

/**
 * Both views of the group a join returned: the room (identity, name, host) and
 * the session (playback state, members). The join response is `{ group }` and
 * that group is the FULL `GroupState::getState()` payload, so it answers both.
 */
interface JoinedGroup {
  room: SyncPlayGroup;
  session: SyncPlaySession;
}

/**
 * A remote playback command as carried over the WebSocket. The wire frames
 * carry no `issued_by`/`issued_at` — the server derives the member identity
 * from the authenticated connection (SPEC.md §4).
 */
type RemotePlaybackCommand = Pick<SyncPlayPlaybackCommand, 'type' | 'position' | 'rate'>;

// ---- Normalization (wire group → @phlix/contracts types) -------------------

/** Coerce an unknown to a finite number, else `fallback`. */
function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

/** Unix SECONDS (the server's unit) → ISO 8601. */
function isoFromUnixSeconds(seconds: unknown): string {
  const s = num(seconds, 0);
  return new Date((s > 0 ? s : Date.now() / 1000) * 1000).toISOString();
}

/** The group id under either spelling (`group_id` from state, `id` from a listing row). */
function groupId(raw: RawSyncPlayGroup): string {
  return raw.group_id ?? raw.id ?? '';
}

/**
 * Normalize the server's `members` — a dict keyed by member id from
 * `GroupState::getState()`, or `[]` from the raw-snapshot fallback — into the
 * store's `SyncPlayUser[]`. The server carries no per-member online flag
 * (membership IS presence), so `isOnline` is `true` for every returned member.
 */
function normalizeMembers(raw: RawSyncPlayGroup | undefined): SyncPlayUser[] {
  const members = raw?.members;
  if (!members) return [];
  const list: RawSyncPlayMember[] = Array.isArray(members)
    ? members
    : Object.entries(members).map(([key, value]) => ({ id: key, ...value }));
  return list.map((m) => ({
    id: m.id ?? '',
    name: m.name ?? 'Unknown',
    profileId: 0,
    role: m.is_host === true ? 'owner' : 'contributor',
    isOnline: true,
    lastSeen: isoFromUnixSeconds(m.joined_at),
  }));
}

/** Same normalization as {@link normalizeMembers}, but to the contracts `SyncPlayMember` shape. */
function normalizeGroupMembers(raw: RawSyncPlayGroup | undefined): SyncPlayMember[] {
  const members = raw?.members;
  if (!members) return [];
  const list: RawSyncPlayMember[] = Array.isArray(members)
    ? members
    : Object.entries(members).map(([key, value]) => ({ id: key, ...value }));
  return list.map((m) => ({
    id: m.id ?? '',
    name: m.name ?? '',
    is_host: m.is_host === true,
    joined_at: num(m.joined_at),
  }));
}

/** Map `playback_state` onto the store's session state. */
function sessionState(raw: RawSyncPlayGroup): SyncPlaySession['state'] {
  switch (raw.playback_state) {
    case 'playing':
      return 'playing';
    case 'paused':
      return 'paused';
    // `buffering` and `stopped` are both "not yet in sync" from the store's side.
    default:
      return raw.is_playing === true ? 'playing' : 'waiting';
  }
}

/**
 * Map a raw server group onto the contracts `SyncPlayGroup`.
 *
 * `is_playing` is derived from `playback_state` (the listing rows carry the
 * flag; the group state does not). `has_password` is the only public/private
 * signal the server emits, and only on the listing rows.
 */
function normalizeGroup(raw: RawSyncPlayGroup | undefined): SyncPlayGroup {
  const g = raw ?? {};
  const id = groupId(g);
  return {
    id,
    name: g.group_name ?? g.name ?? '',
    member_count: num(g.member_count, normalizeMembers(g).length),
    has_password: g.has_password === true,
    current_media: g.current_media_id ?? null,
    is_playing: g.is_playing === true || g.playback_state === 'playing',
    members: normalizeGroupMembers(g),
    host_id: g.host_id ?? '',
    current_media_id: g.current_media_id ?? null,
    current_media_duration: g.current_media_duration ?? null,
    playback_position: num(g.playback_position),
    playback_state: g.playback_state ?? 'stopped',
    queue: g.queue ?? [],
    created_at: num(g.created_at),
    last_activity_at: num(g.last_activity_at),
  };
}

/**
 * Map a raw server group onto the contracts `SyncPlaySession`.
 *
 * The server has no separate session entity — the GROUP is the session — so
 * the session id IS the group id. `playbackRate` has no server field either; a
 * playing group is 1× and anything else is 0.
 */
function groupToSession(raw: RawSyncPlayGroup | undefined): SyncPlaySession {
  const g = raw ?? {};
  const id = groupId(g);
  const state = sessionState(g);
  return {
    id,
    roomId: id,
    serverId: '',
    createdBy: g.host_id ?? '',
    createdAt: isoFromUnixSeconds(g.created_at),
    state,
    playbackPosition: num(g.playback_position),
    playbackRate: state === 'playing' ? 1 : 0,
    serverTime: num(g.last_activity_at, Math.floor(Date.now() / 1000)),
    lastSync: isoFromUnixSeconds(g.last_activity_at),
    activeUsers: normalizeMembers(g),
    roles: Object.fromEntries(normalizeMembers(g).map((m) => [m.id, m.role])),
    permissions: {},
  };
}

// ---- API Client (local implementation, the v0.99.0 surface) ----------------

/**
 * Local SyncPlay API client implementation — the five `SyncPlayController`
 * routes registered in phlix-server `src/Server/Core/Application.php`:
 *   - GET  /api/v1/syncplay/groups — list all groups
 *   - POST /api/v1/syncplay/groups — create a group
 *   - GET  /api/v1/syncplay/groups/{id} — get group state (INCLUDING members)
 *   - POST /api/v1/syncplay/groups/{id}/join — join a group
 *   - POST /api/v1/syncplay/groups/{id}/leave — leave a group
 *
 * ⚠ There is no `/groups/{id}/members` endpoint (S276) — the member list
 * comes from the group state — and no playback-command route at all: playback
 * transport is the WebSocket's job (v0.99.0 removed `sendCommand`, which had
 * no route to wire to).
 */
class SyncPlayApiClient {
  constructor(
    private readonly apiBase: string,
    private readonly _token: string,
  ) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiBase}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this._token}`,
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`SyncPlay API error ${response.status}: ${errorBody}`);
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  async createRoom(input: CreateRoomInput): Promise<SyncPlayGroup> {
    const res = await this.request<SyncPlayGroupResponse>('/api/v1/syncplay/groups', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return normalizeGroup(res.group);
  }

  async joinRoom(groupId: string): Promise<JoinedGroup> {
    const res = await this.request<SyncPlayGroupResponse>(
      `/api/v1/syncplay/groups/${encodeURIComponent(groupId)}/join`,
      { method: 'POST' },
    );
    return { room: normalizeGroup(res.group), session: groupToSession(res.group) };
  }

  async leaveRoom(groupId: string): Promise<void> {
    await this.request(`/api/v1/syncplay/groups/${encodeURIComponent(groupId)}/leave`, {
      method: 'POST',
    });
  }

  async getState(groupId: string): Promise<SyncPlaySession> {
    const res = await this.request<SyncPlayGroupResponse>(
      `/api/v1/syncplay/groups/${encodeURIComponent(groupId)}`,
    );
    return groupToSession(res.group);
  }

  async getMembers(groupId: string): Promise<SyncPlayUser[]> {
    const res = await this.request<SyncPlayGroupResponse>(
      `/api/v1/syncplay/groups/${encodeURIComponent(groupId)}`,
    );
    return normalizeMembers(res.group);
  }

  async listGroups(): Promise<SyncPlayGroup[]> {
    const res = await this.request<SyncPlayGroupsResponse>('/api/v1/syncplay/groups');
    return Array.isArray(res.groups) ? res.groups.map(normalizeGroup) : [];
  }
}

// ---- WebSocket URL ---------------------------------------------------------

/**
 * Build the SyncPlay WebSocket URL for a group.
 *
 * The server listens for SyncPlay on port 8097 of the API host (spec §3;
 * `WebSocketServer.php`). The host is derived from `apiBase` — the TV points at
 * a remote server, so `window.location` is not a valid source. The JWT token
 * and the room id travel as query params.
 */
function buildWsUrl(apiBase: string, roomId: string, token: string): string {
  let hostname = '';
  let protocol = 'ws:';
  try {
    const url = new URL(apiBase);
    hostname = url.hostname;
    protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  } catch {
    // Fail fast: an unparsable apiBase cannot produce a socket URL.
    return '';
  }
  return `${protocol}//${hostname}:8097?token=${encodeURIComponent(token)}&room=${encodeURIComponent(roomId)}`;
}

// ---- Store Definition -----------------------------------------------------

export const useSyncPlayStore = defineStore('phlix-syncplay', () => {
  // ---- State ---------------------------------------------------------------

  const currentRoom = ref<SyncPlayGroup | null>(null);
  const currentSession = ref<SyncPlaySession | null>(null);
  const members = ref<SyncPlayUser[]>([]);
  const error = ref<string | null>(null);
  const isLoading = ref(false);

  // WebSocket state
  const wsConnection = ref<WebSocket | null>(null);
  const wsConnected = ref(false);
  const wsReconnecting = ref(false);
  const wsError = ref<string | null>(null);

  // Active @phlix/syncplay client for the current socket.
  let syncPlayClient: SyncPlayClient | null = null;

  // This store instance's member id — minted once and reused across reconnects
  // so the server sees the same member come back (mirrors @phlix/ui).
  let memberId: string | null = null;

  // ---- Computed ------------------------------------------------------------

  const isInRoom = computed(() => currentSession.value !== null);

  const isSynced = computed(() => {
    if (!currentSession.value) return false;
    return currentSession.value.state === 'playing' || currentSession.value.state === 'paused';
  });

  const onlineMembers = computed(() => members.value.filter((m) => m.isOnline));

  const syncStatus = computed<'synced' | 'outOfSync' | 're-syncing'>(() => {
    if (!currentSession.value) return 'outOfSync';
    return isSynced.value ? 'synced' : 're-syncing';
  });

  // ---- WebSocket Helpers ----------------------------------------------------

  /**
   * Adopt a raw server group into the store state: room, session and members.
   * Used by the REST create/join paths and by every `syncplay_group_state`
   * frame that arrives over the WebSocket.
   */
  function applyGroupState(raw: RawSyncPlayGroup): void {
    currentRoom.value = normalizeGroup(raw);
    currentSession.value = groupToSession(raw);
    members.value = normalizeMembers(raw);
  }

  /**
   * Connect to the SyncPlay WebSocket for a group.
   * Returns early if already connected to this group.
   */
  function connectWs(apiBase: string, roomId: string, token: string): void {
    // Early exit if already connected to this group
    if (wsConnection.value && wsConnection.value.readyState === WebSocket.OPEN) {
      if (currentRoom.value?.id === roomId) return;
      // Different group — close the existing connection first
      disconnectWs();
    }

    const url = buildWsUrl(apiBase, roomId, token);
    if (!url) {
      wsError.value = 'Invalid server URL — cannot open SyncPlay WebSocket';
      return;
    }

    try {
      const client = new SyncPlayClient({
        send: (message) => {
          if (!wsConnection.value || wsConnection.value.readyState !== WebSocket.OPEN) return;
          try {
            wsConnection.value.send(serializeMessage(message));
          } catch (e) {
            // Fail loud: a dying socket must not throw into SyncPlayClient
            // callers (joinGroup during onopen, sendCommand dispatch).
            wsError.value = 'Failed to send WebSocket message';
            console.error('[SyncPlay] Failed to send WebSocket message:', e);
          }
        },
        now: () => Date.now(),
        memberId: memberId ?? (memberId = `member_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`),
        onState: (group) => applyGroupState(group),
        onPlaybackCommand: (command) =>
          onRemoteCommand({ type: command.type, position: command.position }),
        onPlaybackSync: (_memberId, position, isPlaying) =>
          onRemoteCommand({ type: isPlaying ? 'play' : 'pause', position }),
        onError: (code, message) => {
          wsError.value = `${code}: ${message}`;
        },
      });
      syncPlayClient = client;

      const ws = new WebSocket(url);

      ws.onopen = () => {
        wsConnected.value = true;
        wsReconnecting.value = false;
        wsError.value = null;
        // A successful (re)connect clears the backoff budget (S283 lesson from
        // @phlix/ui) — a server that recovered on rung three must not carry its
        // used rungs into the next outage.
        reconnectAttempts = 0;
        // (Re)join the group over the socket once connected.
        client.joinGroup(roomId);
      };

      ws.onmessage = (event) => {
        try {
          client.handleIncoming(JSON.parse(event.data as string));
        } catch {
          // Fail fast on parse errors - don't silently ignore malformed data
          wsError.value = 'Failed to parse WebSocket message';
        }
      };

      ws.onerror = () => {
        wsError.value = 'WebSocket connection error';
        wsConnected.value = false;
      };

      ws.onclose = (event) => {
        if (wsConnection.value !== ws) return;
        wsConnection.value = null;
        wsConnected.value = false;
        client.onDisconnect();

        // Auto-reconnect on unexpected close (not manual disconnect)
        if (event.code !== 1000 && event.code !== 1001 && isInRoom.value && !wsReconnecting.value) {
          scheduleReconnect(apiBase, roomId, token);
        }
      };

      wsConnection.value = ws;
    } catch (e) {
      wsError.value = e instanceof Error ? e.message : 'Failed to connect WebSocket';
      wsConnected.value = false;
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff.
   */
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  const BASE_RECONNECT_DELAY = 1000;

  function scheduleReconnect(apiBase: string, roomId: string, token: string): void {
    // Fail fast if max attempts reached
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      wsError.value = 'Failed to reconnect after multiple attempts';
      wsReconnecting.value = false;
      return;
    }

    wsReconnecting.value = true;
    const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts);
    reconnectAttempts++;

    reconnectTimeout = setTimeout(() => {
      if (isInRoom.value) {
        connectWs(apiBase, roomId, token);
      }
    }, delay);
  }

  /**
   * Disconnect from the WebSocket and clear reconnect state.
   */
  function disconnectWs(): void {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    reconnectAttempts = 0;
    wsReconnecting.value = false;

    if (syncPlayClient) {
      syncPlayClient.leaveGroup();
      syncPlayClient.onDisconnect();
      syncPlayClient = null;
    }

    if (wsConnection.value) {
      wsConnection.value.close(1000, 'User left room');
      wsConnection.value = null;
    }
    wsConnected.value = false;
  }

  // ---- Actions -------------------------------------------------------------

  /**
   * Handle a remote playback command from another member of the group.
   * Updates local session state based on the command type. Receive-side
   * application is intentionally untouched by the seconds→ms boundary work
   * (S293 scope); positions are applied verbatim.
   */
  function onRemoteCommand(command: RemotePlaybackCommand): void {
    if (!currentSession.value) return;

    switch (command.type) {
      case 'play':
        currentSession.value = { ...currentSession.value, state: 'playing' };
        break;

      case 'pause':
        currentSession.value = { ...currentSession.value, state: 'paused' };
        break;

      case 'seek':
        if (command.position !== undefined) {
          currentSession.value = { ...currentSession.value, playbackPosition: command.position };
        }
        break;

      case 'sync':
        if (command.position !== undefined) {
          currentSession.value = { ...currentSession.value, playbackPosition: command.position };
        }
        if (command.rate !== undefined) {
          currentSession.value = { ...currentSession.value, playbackRate: command.rate };
        }
        break;
    }
  }

  /**
   * Create a new SyncPlay group and join it.
   * Establishes WebSocket connection on successful join.
   */
  async function createAndJoinRoom(
    apiBase: string,
    token: string,
    input: CreateRoomInput,
  ): Promise<void> {
    // Fail fast if already in a room
    if (isInRoom.value) {
      error.value = 'Already in a room. Leave current room first.';
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const api = new SyncPlayApiClient(apiBase, token);
      const room = await api.createRoom(input);

      // The join response is the full group state — the room AND the session.
      const joined = await api.joinRoom(room.id);
      currentRoom.value = joined.room;
      currentSession.value = joined.session;
      members.value = joined.session.activeUsers;

      // Establish WebSocket connection after successful join
      connectWs(apiBase, joined.room.id, token);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create room';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Join an existing SyncPlay group by ID.
   * Establishes WebSocket connection on successful join.
   */
  async function joinRoom(apiBase: string, token: string, roomId: string): Promise<void> {
    // Fail fast if already in a room
    if (isInRoom.value) {
      error.value = 'Already in a room. Leave current room first.';
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const api = new SyncPlayApiClient(apiBase, token);

      // Join the room — the response carries the full group state (members
      // included), so no separate member fetch is needed or possible (S276).
      const joined = await api.joinRoom(roomId);
      currentRoom.value = joined.room;
      currentSession.value = joined.session;
      members.value = joined.session.activeUsers;

      // Establish WebSocket connection after successful join
      connectWs(apiBase, roomId, token);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to join room';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Leave the current SyncPlay group.
   * Closes WebSocket connection and clears state.
   */
  async function leaveRoom(apiBase: string, token: string): Promise<void> {
    if (!currentRoom.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      const api = new SyncPlayApiClient(apiBase, token);
      await api.leaveRoom(currentRoom.value.id);

      // Disconnect WebSocket before clearing state
      disconnectWs();

      currentRoom.value = null;
      currentSession.value = null;
      members.value = [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to leave room';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Send a local playback command to the group.
   * Playback transport is the WebSocket (`@phlix/syncplay` frames) — the REST
   * command route does not exist (v0.99.0 removed `sendCommand` from the API
   * client). No-op when the socket is not connected.
   */
  async function sendCommand(
    _apiBase: string,
    _token: string,
    type: SyncPlayPlaybackCommand['type'],
    options?: { position?: number; rate?: number },
  ): Promise<void> {
    if (!currentSession.value) return;

    const command: SyncPlayPlaybackCommand = {
      type,
      // S293: `options.position` is SECONDS (the store-internal unit); the
      // wire unit is MILLISECONDS (phlix-syncplay SPEC.md:91). Convert at the
      // send boundary. `undefined` stays `undefined` so a play/pause without
      // a position never reaches `undefined * 1000` (NaN).
      position: options?.position !== undefined ? options.position * 1000 : undefined,
      rate: options?.rate,
      issued_by: currentSession.value.createdBy,
      issued_at: new Date().toISOString(),
    };

    if (!syncPlayClient) return;

    switch (command.type) {
      case 'play':
        syncPlayClient.sendPlay(command.position ?? 0);
        break;
      case 'pause':
        syncPlayClient.sendPause(command.position ?? 0);
        break;
      case 'seek':
        if (command.position !== undefined) {
          syncPlayClient.sendSeek(0, command.position);
        }
        break;
      case 'sync':
        if (command.position !== undefined) {
          syncPlayClient.reportPosition(command.position, true);
        }
        break;
    }
  }

  /**
   * Refresh the current session state from the server.
   */
  async function refreshState(apiBase: string, token: string): Promise<void> {
    if (!currentSession.value) return;

    try {
      const api = new SyncPlayApiClient(apiBase, token);
      const session = await api.getState(currentSession.value.id);
      currentSession.value = session;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to refresh state';
      throw e;
    }
  }

  /**
   * Refresh the members list from the server.
   */
  async function refreshMembers(apiBase: string, token: string): Promise<void> {
    if (!currentRoom.value) return;

    try {
      const api = new SyncPlayApiClient(apiBase, token);
      const membersList = await api.getMembers(currentRoom.value.id);
      members.value = membersList;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to refresh members';
      throw e;
    }
  }

  /**
   * Fetch the list of public groups available to join.
   */
  async function fetchPublicRooms(apiBase: string, token: string): Promise<SyncPlayGroup[]> {
    try {
      const api = new SyncPlayApiClient(apiBase, token);
      return await api.listGroups();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch public rooms';
      throw e;
    }
  }

  /**
   * Clear any error state.
   */
  function clearError(): void {
    error.value = null;
    wsError.value = null;
  }

  // ---- Return ---------------------------------------------------------------

  return {
    // State
    currentRoom,
    currentSession,
    members,
    error,
    isLoading,
    // WebSocket state
    wsConnected,
    wsReconnecting,
    wsError,
    // Computed
    isInRoom,
    isSynced,
    onlineMembers,
    syncStatus,
    // Actions
    createAndJoinRoom,
    joinRoom,
    leaveRoom,
    sendCommand,
    refreshState,
    refreshMembers,
    fetchPublicRooms,
    onRemoteCommand,
    clearError,
    // WebSocket (internal but exposed for debugging)
    connectWs,
    disconnectWs,
  };
});