/**
 * SyncPlay collaborative playback state management with WebSocket support.
 *
 * Manages the current SyncPlay room session, member list, playback
 * synchronization state, and real-time WebSocket communication for the local user.
 *
 * This store extends the @phlix/ui store with WebSocket real-time sync capabilities.
 * WebSocket connection is established when joining a room and handles:
 *   - Playback commands (play, pause, seek, sync) from other members
 *   - Member join/leave events
 *   - Real-time state synchronization
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  SyncPlayRoom,
  SyncPlaySession,
  SyncPlayUser,
  SyncPlayPlaybackCommand,
} from '@phlix/contracts';

// ---- Types -----------------------------------------------------------------

/** Input for creating a new SyncPlay room. */
interface CreateRoomInput {
  name: string;
  description?: string;
  isPublic: boolean;
}

/** Response envelope for room operations. */
interface SyncPlayRoomResponse {
  room: SyncPlayRoom;
}

/** Response envelope for session operations. */
interface SyncPlaySessionResponse {
  session: SyncPlaySession;
}

/** Response envelope for members listing. */
interface SyncPlayMembersResponse {
  members: SyncPlayUser[];
}

/** WebSocket message types from the server */
type WsMessageType = 'command' | 'member_joined' | 'member_left' | 'state_sync' | 'error';

interface WsMessage {
  type: WsMessageType;
  payload: Record<string, unknown>;
  timestamp: string;
}

interface WsCommandPayload {
  command: SyncPlayPlaybackCommand;
}

interface WsMemberEventPayload {
  user: SyncPlayUser;
}

interface WsStateSyncPayload {
  session: SyncPlaySession;
  members: SyncPlayUser[];
}

interface WsErrorPayload {
  message: string;
  code?: string;
}

// ---- API Client (local implementation) -----------------------------------

/**
 * Local SyncPlay API client implementation.
 * Handles REST API calls for SyncPlay room management.
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

  async createRoom(input: CreateRoomInput): Promise<SyncPlayRoom> {
    const res = await this.request<SyncPlayRoomResponse>('/api/v1/syncplay/rooms', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res.room;
  }

  async joinRoom(roomId: string): Promise<SyncPlaySession> {
    const res = await this.request<SyncPlaySessionResponse>(
      `/api/v1/syncplay/rooms/${encodeURIComponent(roomId)}/join`,
      { method: 'POST' },
    );
    return res.session;
  }

  async leaveRoom(roomId: string): Promise<void> {
    await this.request(`/api/v1/syncplay/rooms/${encodeURIComponent(roomId)}/leave`, {
      method: 'POST',
    });
  }

  async sendCommand(sessionId: string, command: SyncPlayPlaybackCommand): Promise<void> {
    await this.request(`/api/v1/syncplay/sessions/${encodeURIComponent(sessionId)}/command`, {
      method: 'POST',
      body: JSON.stringify(command),
    });
  }

  async getState(sessionId: string): Promise<SyncPlaySession> {
    const res = await this.request<SyncPlaySessionResponse>(
      `/api/v1/syncplay/sessions/${encodeURIComponent(sessionId)}`,
    );
    return res.session;
  }

  async getMembers(roomId: string): Promise<SyncPlayUser[]> {
    const res = await this.request<SyncPlayMembersResponse>(
      `/api/v1/syncplay/rooms/${encodeURIComponent(roomId)}/members`,
    );
    return Array.isArray(res.members) ? res.members : [];
  }

  async listPublicRooms(): Promise<SyncPlayRoom[]> {
    const res = await this.request<{ rooms?: SyncPlayRoom[] }>('/api/v1/syncplay/rooms');
    return Array.isArray(res.rooms) ? res.rooms : [];
  }
}

// ---- Store Definition -----------------------------------------------------

export const useSyncPlayStore = defineStore('phlix-syncplay', () => {
  // ---- State ---------------------------------------------------------------

  const currentRoom = ref<SyncPlayRoom | null>(null);
  const currentSession = ref<SyncPlaySession | null>(null);
  const members = ref<SyncPlayUser[]>([]);
  const error = ref<string | null>(null);
  const isLoading = ref(false);

  // WebSocket state
  const wsConnection = ref<WebSocket | null>(null);
  const wsConnected = ref(false);
  const wsReconnecting = ref(false);
  const wsError = ref<string | null>(null);

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
   * Build the WebSocket URL for a room.
   * Converts https:// to wss:// and appends the room path with JWT token.
   */
  function buildWsUrl(apiBase: string, roomId: string, token: string): string {
    // Convert https://example.com to wss://example.com
    const wsBase = apiBase.replace(/^http/, 'ws');
    const path = `/api/v1/syncplay/${encodeURIComponent(roomId)}`;
    const query = `token=${encodeURIComponent(token)}`;
    return `${wsBase}${path}?${query}`;
  }

  /**
   * Handle incoming WebSocket messages.
   * Parses and processes commands, member events, and state syncs.
   */
  function handleWsMessage(data: WsMessage): void {
    switch (data.type) {
      case 'command': {
        const payload = data.payload as unknown as WsCommandPayload;
        if (payload.command) {
          onRemoteCommand(payload.command);
        }
        break;
      }

      case 'member_joined': {
        const payload = data.payload as unknown as WsMemberEventPayload;
        if (payload.user) {
          // Add user to members if not already present
          const userId = payload.user.id;
          const existingIndex = members.value.findIndex((m) => m.id === userId);
          if (existingIndex === -1) {
            members.value.push(payload.user);
          } else {
            const existing = members.value[existingIndex];
            members.value[existingIndex] = { ...existing, isOnline: true };
          }
        }
        break;
      }

      case 'member_left': {
        const payload = data.payload as unknown as WsMemberEventPayload;
        if (payload.user) {
          // Mark user as offline rather than removing
          const existingIndex = members.value.findIndex((m) => m.id === payload.user.id);
          if (existingIndex !== -1) {
            const existing = members.value[existingIndex];
            members.value[existingIndex] = { ...existing, isOnline: false };
          }
        }
        break;
      }

      case 'state_sync': {
        const payload = data.payload as unknown as WsStateSyncPayload;
        if (payload.session) {
          currentSession.value = payload.session;
        }
        if (payload.members) {
          members.value = payload.members;
        }
        break;
      }

      case 'error': {
        const payload = data.payload as unknown as WsErrorPayload;
        wsError.value = payload.message || 'WebSocket error';
        break;
      }
    }
  }

  /**
   * Connect to the WebSocket for real-time sync.
   * Returns early if already connected to this room.
   */
  function connectWs(apiBase: string, roomId: string, token: string): void {
    // Early exit if already connected to this room
    if (wsConnection.value && wsConnection.value.readyState === WebSocket.OPEN) {
      if (currentRoom.value?.id === roomId) return;
      // Different room - close existing connection first
      disconnectWs();
    }

    const url = buildWsUrl(apiBase, roomId, token);

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        wsConnected.value = true;
        wsReconnecting.value = false;
        wsError.value = null;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WsMessage;
          handleWsMessage(message);
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
        wsConnected.value = false;
        wsConnection.value = null;

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

    if (wsConnection.value) {
      wsConnection.value.close(1000, 'User left room');
      wsConnection.value = null;
    }
    wsConnected.value = false;
  }

  /**
   * Send a message through the WebSocket connection.
   * Returns early if not connected (fail fast principle).
   */
  function sendWsMessage(message: Record<string, unknown>): void {
    if (!wsConnection.value || wsConnection.value.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      wsConnection.value.send(JSON.stringify(message));
    } catch (e) {
      // Log but don't throw - WebSocket send failure shouldn't halt the app
      console.error('[SyncPlay] Failed to send WebSocket message:', e);
    }
  }

  // ---- Actions -------------------------------------------------------------

  /**
   * Handle a remote playback command from another user in the room.
   * Updates local session state based on the command type.
   */
  function onRemoteCommand(command: SyncPlayPlaybackCommand): void {
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
   * Create a new SyncPlay room and join it.
   * Establishes WebSocket connection on successful join.
   */
  async function createAndJoinRoom(
    apiBase: string,
    token: string,
    input: { name: string; description?: string; isPublic: boolean },
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
      currentRoom.value = room;

      const session = await api.joinRoom(room.id);
      currentSession.value = session;
      members.value = session.activeUsers;

      // Establish WebSocket connection after successful join
      connectWs(apiBase, room.id, token);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create room';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Join an existing SyncPlay room by ID.
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

      // Fetch room members
      const membersList = await api.getMembers(roomId);
      members.value = membersList;

      // Join the room
      const session = await api.joinRoom(roomId);
      currentSession.value = session;

      // Update room with session info
      if (currentRoom.value) {
        currentRoom.value = { ...currentRoom.value, currentSession: session };
      }

      // Refresh members from session
      members.value = session.activeUsers;

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
   * Leave the current SyncPlay room.
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
   * Send a local playback command to the room.
   * Sends via both REST API (persistence) and WebSocket (real-time).
   */
  async function sendCommand(
    apiBase: string,
    token: string,
    type: SyncPlayPlaybackCommand['type'],
    options?: { position?: number; rate?: number },
  ): Promise<void> {
    if (!currentSession.value) return;

    const command: SyncPlayPlaybackCommand = {
      type,
      position: options?.position,
      rate: options?.rate,
      issuedBy: currentSession.value.createdBy,
      issuedAt: new Date().toISOString(),
    };

    try {
      const api = new SyncPlayApiClient(apiBase, token);
      await api.sendCommand(currentSession.value.id, command);

      // Also broadcast via WebSocket for real-time sync
      sendWsMessage({ type: 'command', payload: { command } });
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to send command';
      throw e;
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
   * Fetch the list of public rooms available to join.
   */
  async function fetchPublicRooms(apiBase: string, token: string): Promise<SyncPlayRoom[]> {
    try {
      const api = new SyncPlayApiClient(apiBase, token);
      return await api.listPublicRooms();
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
