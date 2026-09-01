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
 * `@phlix/contracts` v0.4.6 (S415 type truth: `SyncPlayGroup` IS the
 * `GroupState::getState()` emission with a DICT `members`, the list-row
 * vocabulary lives on `SyncPlayGroupListItem`, and the five REST envelopes
 * are declared) and framed by `@phlix/syncplay` v0.1.2.
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
  SyncPlayGroupListItem,
  SyncPlayMembersDict,
  SyncPlayQueueItem,
  SyncPlayRole,
  SyncPlayPermission,
} from '@phlix/contracts';
import { SyncPlayClient, serializeMessage } from '@phlix/syncplay';
import type { PendingPlayMediaCommand } from '../api/hubRelay';

// ---- Types -----------------------------------------------------------------

/**
 * One member as the STORE views them: a local (camelCase) presentation of a
 * contracts {@link SyncPlayMember} — the server wire carries only
 * `{id, name, is_host, joined_at}` inside the group-state `members` dict;
 * `profileId` has no server field (0), membership IS presence so `isOnline`
 * is always `true` for a returned member, `role` is derived from `is_host`,
 * and `lastSeen` is derived from `joined_at`.
 *
 * S415 note: this shape used to be typed by the contracts `SyncPlayUser`,
 * which the server never emitted and which has been retired from
 * `@phlix/contracts` — the view is now declared here, honestly, as the
 * local derivation it always was.
 */
export interface LocalSyncPlayMember {
  id: string;
  name: string;
  profileId: number;
  role: SyncPlayRole;
  isOnline: boolean;
  lastSeen: string; // ISO 8601
}

/**
 * The store's session shape — a LOCAL view derived from the group state (the
 * server has no separate session entity: the GROUP is the session). Carries
 * the wire's `current_media_id` as `currentMediaId` (S298).
 *
 * Produced by {@link groupToSession} from the server's `current_media_id`
 * (the group state emits it — the field is NOT pinned null), and written
 * into the live session by {@link applyPendingPlayMedia} (the paired caller —
 * the hub-relay consumer's "Alexa, play X" command carries the media id).
 * The load-a-new-title dispatch point (`src/syncplayDispatch.ts`) consumes
 * the command's own `mediaId` — exactly like the ui's Player.vue — so the
 * session field stays a faithful wire carry + live-session signal for future
 * session UI, never the load path's input.
 *
 * S415 note: this used to extend the contracts `SyncPlaySession`, a ghost
 * type the server never emitted (retired in contracts v0.4.6). The camelCase
 * session vocabulary is the store's own model, and now says so in its types.
 */
export interface LocalSyncPlaySession {
  /** The group id — the group IS the session. */
  id: string;
  roomId: string;
  serverId: string;
  createdBy: string; // host member id
  createdAt: string; // ISO 8601
  state: 'waiting' | 'playing' | 'paused' | 'ended';
  /** Media item id the group is (or last was) playing — `null` when none. */
  currentMediaId: string | null;
  playbackPosition: number; // ms — the wire unit (S293)
  playbackRate: number;
  serverTime: number; // unix seconds
  lastSync: string; // ISO 8601
  activeUsers: LocalSyncPlayMember[];
  roles: Record<string, SyncPlayRole>;
  permissions: Record<string, SyncPlayPermission[]>;
}

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
  /** Listing rows spell it `current_media` (contracts `SyncPlayGroupListItem`). */
  current_media?: string | null;
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
  session: LocalSyncPlaySession;
}

/** Playback command verbs the store sends and receives. */
type PlaybackCommandType = 'play' | 'pause' | 'seek' | 'sync';

/**
 * A remote playback command as carried over the WebSocket. The wire frames
 * carry no `issued_by`/`issued_at` — the server derives the member identity
 * from the authenticated connection (SPEC.md §4).
 *
 * S415 note: this used to be a `Pick` of the contracts
 * `SyncPlayPlaybackCommand`, a ghost type the server never emitted (retired
 * in contracts v0.4.6). The command verbs are the store's own transport
 * vocabulary, and now declare it.
 */
type RemotePlaybackCommand = {
  type: PlaybackCommandType;
  /** Milliseconds — the wire unit; applied verbatim on receive (S293). */
  position?: number;
  rate?: number;
};

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
 * store's `LocalSyncPlayMember[]`. The server carries no per-member online
 * flag (membership IS presence), so `isOnline` is `true` for every returned
 * member.
 */
function normalizeMembers(raw: RawSyncPlayGroup | undefined): LocalSyncPlayMember[] {
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

/**
 * Same normalization as {@link normalizeMembers}, but to the contracts
 * `SyncPlayMember` shape — kept as the DICTIONARY the server emits, keyed by
 * member id (S415: `members` is a dict on the wire; the array spelling is
 * only the raw-snapshot fallback / pre-S416 lib output, so it folds in).
 */
function normalizeGroupMembers(raw: RawSyncPlayGroup | undefined): SyncPlayMembersDict {
  const members = raw?.members;
  if (!members) return {};
  const list: RawSyncPlayMember[] = Array.isArray(members)
    ? members
    : Object.entries(members).map(([key, value]) => ({ id: key, ...value }));
  const dict: SyncPlayMembersDict = {};
  for (const m of list) {
    const id = m.id ?? '';
    dict[id] = {
      id,
      name: m.name ?? '',
      is_host: m.is_host === true,
      joined_at: num(m.joined_at),
    };
  }
  return dict;
}

/** Map `playback_state` onto the store's session state. */
function sessionState(raw: RawSyncPlayGroup): LocalSyncPlaySession['state'] {
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

/** One queue entry of the group state, parsed to the contracts `SyncPlayQueueItem`. */
function normalizeQueueItem(item: unknown): SyncPlayQueueItem {
  const q = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
  const info = q.media_info;
  return {
    media_id: typeof q.media_id === 'string' ? q.media_id : '',
    media_info: typeof info === 'object' && info !== null ? (info as Record<string, unknown>) : {},
    added_at: num(q.added_at),
    added_by: typeof q.added_by === 'string' ? q.added_by : null,
  };
}

/**
 * Map a raw server group state onto the contracts `SyncPlayGroup` — the
 * verbatim `GroupState::getState()` vocabulary (S415 authority ruling):
 * `group_id`/`group_name`, dict-keyed `members`, nullable `host_id`/
 * `current_media_id`, no `has_password`/`current_media`/`is_playing` — those
 * three belong to LIST ROWS ({@link normalizeListRow}), never to the state.
 *
 * The raw view is still read with fallbacks (listing rows reach some call
 * sites on older paths), but the RESULT is honest: a `SyncPlayGroup` only
 * ever carries state keys.
 */
function normalizeGroup(raw: RawSyncPlayGroup | undefined): SyncPlayGroup {
  const g = raw ?? {};
  const members = normalizeGroupMembers(g);
  return {
    group_id: groupId(g),
    group_name: g.group_name ?? g.name ?? '',
    member_count: num(g.member_count, Object.keys(members).length),
    members,
    host_id: typeof g.host_id === 'string' && g.host_id !== '' ? g.host_id : null,
    current_media_id: g.current_media_id ?? g.current_media ?? null,
    current_media_duration: num(g.current_media_duration),
    playback_position: num(g.playback_position),
    playback_state: g.playback_state ?? 'stopped',
    queue: (Array.isArray(g.queue) ? g.queue : []).map(normalizeQueueItem),
    created_at: num(g.created_at),
    last_activity_at: num(g.last_activity_at),
  };
}

/**
 * Map a raw LIST ROW onto the contracts `SyncPlayGroupListItem` — the
 * list-only vocabulary (`id`/`name`/`has_password`/`current_media`/
 * `is_playing`) as `SyncPlaySnapshotService::listGroups()` emits it.
 */
function normalizeListRow(raw: RawSyncPlayGroup): SyncPlayGroupListItem {
  return {
    id: groupId(raw),
    name: raw.group_name ?? raw.name ?? '',
    member_count: num(raw.member_count),
    has_password: raw.has_password === true,
    current_media: raw.current_media ?? raw.current_media_id ?? null,
    is_playing: raw.is_playing === true || raw.playback_state === 'playing',
  };
}

/**
 * Map a raw server group onto the store's local session view.
 *
 * The server has no separate session entity — the GROUP is the session — so
 * the session id IS the group id. `playbackRate` has no server field either; a
 * playing group is 1× and anything else is 0. `currentMediaId` carries the
 * wire's `current_media_id` through (`null` when the group has no media yet —
 * S298: the paired caller is {@link applyPendingPlayMedia}).
 */
function groupToSession(raw: RawSyncPlayGroup | undefined): LocalSyncPlaySession {
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
    currentMediaId: g.current_media_id ?? g.current_media ?? null,
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

  async getState(groupId: string): Promise<LocalSyncPlaySession> {
    const res = await this.request<SyncPlayGroupResponse>(
      `/api/v1/syncplay/groups/${encodeURIComponent(groupId)}`,
    );
    return groupToSession(res.group);
  }

  async getMembers(groupId: string): Promise<LocalSyncPlayMember[]> {
    const res = await this.request<SyncPlayGroupResponse>(
      `/api/v1/syncplay/groups/${encodeURIComponent(groupId)}`,
    );
    return normalizeMembers(res.group);
  }

  async listGroups(): Promise<SyncPlayGroupListItem[]> {
    const res = await this.request<SyncPlayGroupsResponse>('/api/v1/syncplay/groups');
    return Array.isArray(res.groups) ? res.groups.map(normalizeListRow) : [];
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
  const currentSession = ref<LocalSyncPlaySession | null>(null);
  const members = ref<LocalSyncPlayMember[]>([]);
  const error = ref<string | null>(null);
  const isLoading = ref(false);
  /** A hub-relay `pending_command` / `play_media` frame awaiting the
   *  load-a-new-title dispatch point (S298). Cleared by
   *  {@link consumePendingPlayMedia}. */
  const pendingPlayMedia = ref<PendingPlayMediaCommand | null>(null);

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
      if (currentRoom.value?.group_id === roomId) return;
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
   * Adopt a hub-relay `pending_command` / `play_media` frame (S298).
   *
   * The hub's SyncPlay relay delivers "Alexa, play X" to the app's open
   * `:8804` socket (see `src/api/hubRelay.ts`) REGARDLESS of SyncPlay room
   * membership — the primary case has no room at all. This action is the
   * store-side consumer:
   *
   * - `pendingPlayMedia` holds the command for the load-a-new-title dispatch
   *   point (`src/syncplayDispatch.ts` — the ONLY place that can start
   *   playback from a bare media id).
   * - When a session exists, `currentMediaId` is written into it — the paired
   *   caller for the `groupToSession()` carry-through: the field is produced
   *   here (hub consumer) and consumed by the dispatch point, so it is not
   *   dead wiring.
   */
  function applyPendingPlayMedia(command: PendingPlayMediaCommand): void {
    pendingPlayMedia.value = command;
    if (currentSession.value) {
      currentSession.value = { ...currentSession.value, currentMediaId: command.mediaId };
    }
  }

  /**
   * Mark the pending play-media command as handled (the dispatch point loaded
   * the title). Clears the store slot so a later session update cannot
   * re-trigger the load path.
   */
  function consumePendingPlayMedia(): void {
    pendingPlayMedia.value = null;
  }

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
      const joined = await api.joinRoom(room.group_id);
      currentRoom.value = joined.room;
      currentSession.value = joined.session;
      members.value = joined.session.activeUsers;

      // Establish WebSocket connection after successful join
      connectWs(apiBase, joined.room.group_id, token);
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
      await api.leaveRoom(currentRoom.value.group_id);

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
     type: PlaybackCommandType,
     options?: { position?: number; rate?: number },
   ): Promise<void> {
     if (!currentSession.value) return;

    // `issued_by`/`issued_at` were never read past here (the server derives the
    // member identity from the authenticated connection — SPEC.md §4), so the
    // local command carries exactly what dispatch consumes.
    const command: RemotePlaybackCommand = {
      type,
      // S293: `options.position` is SECONDS (the store-internal unit); the
      // wire unit is MILLISECONDS (phlix-syncplay SPEC.md:91). Convert at the
      // send boundary. `undefined` stays `undefined` so a play/pause without
      // a position never reaches `undefined * 1000` (NaN).
      position: options?.position !== undefined ? options.position * 1000 : undefined,
      rate: options?.rate,
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
      const membersList = await api.getMembers(currentRoom.value.group_id);
      members.value = membersList;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to refresh members';
      throw e;
    }
  }

  /**
   * Fetch the list of public groups available to join.
   */
  async function fetchPublicRooms(apiBase: string, token: string): Promise<SyncPlayGroupListItem[]> {
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
    // S298: the hub-relay pending_command awaiting the load path.
    pendingPlayMedia,
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
    // S298: hub-relay pending_command consumer pair.
    applyPendingPlayMedia,
    consumePendingPlayMedia,
    // WebSocket (internal but exposed for debugging)
    connectWs,
    disconnectWs,
  };
});