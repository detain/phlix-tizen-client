import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { SyncPlayClient } from '@phlix/syncplay';
import { useSyncPlayStore } from '@/stores/useSyncPlayStore';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock WebSocket globally
class MockWebSocket {
  onopen: ((event: any) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  readyState = 1; // OPEN
  close = vi.fn();
  send = vi.fn();
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
}
globalThis.WebSocket = MockWebSocket as any;

describe('useSyncPlayStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('has null currentRoom', () => {
      const store = useSyncPlayStore();
      expect(store.currentRoom).toBeNull();
    });

    it('has null currentSession', () => {
      const store = useSyncPlayStore();
      expect(store.currentSession).toBeNull();
    });

    it('has empty members array', () => {
      const store = useSyncPlayStore();
      expect(store.members).toEqual([]);
    });

    it('has null error', () => {
      const store = useSyncPlayStore();
      expect(store.error).toBeNull();
    });

    it('has isLoading as false', () => {
      const store = useSyncPlayStore();
      expect(store.isLoading).toBe(false);
    });

    it('has wsConnected as false', () => {
      const store = useSyncPlayStore();
      expect(store.wsConnected).toBe(false);
    });

    it('has wsReconnecting as false', () => {
      const store = useSyncPlayStore();
      expect(store.wsReconnecting).toBe(false);
    });

    it('has wsError as null', () => {
      const store = useSyncPlayStore();
      expect(store.wsError).toBeNull();
    });
  });

  describe('computed properties', () => {
    describe('isInRoom', () => {
      it('returns false when no session', () => {
        const store = useSyncPlayStore();
        expect(store.isInRoom).toBe(false);
      });

      it('returns true when session exists', () => {
        const store = useSyncPlayStore();
        // @ts-expect-error - setting directly for test
        store.currentSession = { id: 'session-1', state: 'playing' };
        expect(store.isInRoom).toBe(true);
      });
    });

    describe('isSynced', () => {
      it('returns false when no session', () => {
        const store = useSyncPlayStore();
        expect(store.isSynced).toBe(false);
      });

      it('returns true when state is playing', () => {
        const store = useSyncPlayStore();
        // @ts-expect-error - setting directly for test
        store.currentSession = { id: 'session-1', state: 'playing' };
        expect(store.isSynced).toBe(true);
      });

      it('returns true when state is paused', () => {
        const store = useSyncPlayStore();
        // @ts-expect-error - setting directly for test
        store.currentSession = { id: 'session-1', state: 'paused' };
        expect(store.isSynced).toBe(true);
      });

      it('returns false when state is not playing or paused', () => {
        const store = useSyncPlayStore();
        // @ts-expect-error - setting directly for test
        store.currentSession = { id: 'session-1', state: 'idle' };
        expect(store.isSynced).toBe(false);
      });
    });

    describe('onlineMembers', () => {
      it('filters members by isOnline', () => {
        const store = useSyncPlayStore();
        // @ts-expect-error - setting directly for test
        store.members = [
          { id: '1', name: 'User 1', isOnline: true },
          { id: '2', name: 'User 2', isOnline: false },
          { id: '3', name: 'User 3', isOnline: true }
        ];
        expect(store.onlineMembers).toHaveLength(2);
      });
    });

    describe('syncStatus', () => {
      it('returns outOfSync when no session', () => {
        const store = useSyncPlayStore();
        expect(store.syncStatus).toBe('outOfSync');
      });

      it('returns synced when playing', () => {
        const store = useSyncPlayStore();
        // @ts-expect-error - setting directly for test
        store.currentSession = { id: 'session-1', state: 'playing' };
        expect(store.syncStatus).toBe('synced');
      });

      it('returns synced when paused', () => {
        const store = useSyncPlayStore();
        // @ts-expect-error - setting directly for test
        store.currentSession = { id: 'session-1', state: 'paused' };
        expect(store.syncStatus).toBe('synced');
      });

      it('returns re-syncing when not synced', () => {
        const store = useSyncPlayStore();
        // @ts-expect-error - setting directly for test
        store.currentSession = { id: 'session-1', state: 'idle' };
        expect(store.syncStatus).toBe('re-syncing');
      });
    });
  });

  describe('clearError', () => {
    it('clears both error and wsError', () => {
      const store = useSyncPlayStore();
      // @ts-expect-error - setting directly for test
      store.error = 'Some error';
      // @ts-expect-error - setting directly for test
      store.wsError = 'WebSocket error';
      store.clearError();
      expect(store.error).toBeNull();
      expect(store.wsError).toBeNull();
    });
  });

  describe('hub-relay pending_command consumer (S298)', () => {
    const pendingFrame = {
      type: 'pending_command' as const,
      command: 'play_media' as const,
      serverId: 'srv-abc123',
      mediaId: 'media-9',
      title: 'Inception',
      issuedAt: 1_700_000_000,
      source: 'alexa',
    };

    it('starts with a null pendingPlayMedia slot', () => {
      const store = useSyncPlayStore();
      expect(store.pendingPlayMedia).toBeNull();
    });

    it('applyPendingPlayMedia adopts the frame into the pending slot', () => {
      const store = useSyncPlayStore();
      store.applyPendingPlayMedia(pendingFrame);
      expect(store.pendingPlayMedia).toEqual(pendingFrame);
    });

    it('applyPendingPlayMedia carries currentMediaId into the live session (the paired caller)', () => {
      const store = useSyncPlayStore();
      // @ts-expect-error - setting directly for test
      store.currentSession = { id: 'session-1', state: 'playing', currentMediaId: 'old-media' };
      store.applyPendingPlayMedia(pendingFrame);
      expect(store.currentSession?.currentMediaId).toBe('media-9');
      // The rest of the session survives the carry.
      expect(store.currentSession?.id).toBe('session-1');
      expect(store.currentSession?.state).toBe('playing');
    });

    it('applyPendingPlayMedia with no session still holds the pending slot', () => {
      const store = useSyncPlayStore();
      store.applyPendingPlayMedia(pendingFrame);
      expect(store.pendingPlayMedia).toEqual(pendingFrame);
      expect(store.currentSession).toBeNull();
    });

    it('consumePendingPlayMedia clears the pending slot', () => {
      const store = useSyncPlayStore();
      store.applyPendingPlayMedia(pendingFrame);
      store.consumePendingPlayMedia();
      expect(store.pendingPlayMedia).toBeNull();
    });

    it('groupToSession maps the wire current_media_id into the session', async () => {
      const store = useSyncPlayStore();
      // refreshState needs a live session to know which group to refresh.
      // @ts-expect-error - setting directly for test
      store.currentSession = { id: 'session-1', state: 'playing', currentMediaId: null };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            group: {
              group_id: 'session-1',
              group_name: 'Room',
              playback_state: 'playing',
              current_media_id: 'media-7',
              members: {},
            },
          }),
      });
      await store.refreshState('https://api.example.com', 'token');
      expect(store.currentSession?.currentMediaId).toBe('media-7');
    });
  });

  describe('handleWsMessage (internal function via onRemoteCommand)', () => {
    it('onRemoteCommand handles play command', () => {
      const store = useSyncPlayStore();
      // @ts-expect-error - setting directly for test
      store.currentSession = { id: 'session-1', state: 'paused' };
      const command = { type: 'play', position: 100 };
      store.onRemoteCommand(command);
      expect(store.currentSession?.state).toBe('playing');
    });

    it('onRemoteCommand handles pause command', () => {
      const store = useSyncPlayStore();
      // @ts-expect-error - setting directly for test
      store.currentSession = { id: 'session-1', state: 'playing' };
      const command = { type: 'pause' };
      store.onRemoteCommand(command);
      expect(store.currentSession?.state).toBe('paused');
    });

    it('onRemoteCommand handles seek command with position', () => {
      const store = useSyncPlayStore();
      // @ts-expect-error - setting directly for test
      store.currentSession = { id: 'session-1', state: 'playing', playbackPosition: 50 };
      const command = { type: 'seek', position: 200 };
      store.onRemoteCommand(command);
      expect(store.currentSession?.playbackPosition).toBe(200);
    });

    it('onRemoteCommand handles sync command with position and rate', () => {
      const store = useSyncPlayStore();
      // @ts-expect-error - setting directly for test
      store.currentSession = { id: 'session-1', state: 'playing', playbackPosition: 50, playbackRate: 1.0 };
      const command = { type: 'sync', position: 300, rate: 1.5 };
      store.onRemoteCommand(command);
      expect(store.currentSession?.playbackPosition).toBe(300);
      expect(store.currentSession?.playbackRate).toBe(1.5);
    });

    it('onRemoteCommand ignores commands when no session', () => {
      const store = useSyncPlayStore();
      expect(() => store.onRemoteCommand({ type: 'play' })).not.toThrow();
    });
  });

  describe('createAndJoinRoom', () => {
    it('fails fast if already in a room - sets error and returns', async () => {
      const store = useSyncPlayStore();
      // @ts-expect-error - setting directly for test
      store.currentSession = { id: 'existing-session' };

      await store.createAndJoinRoom('https://api.example.com', 'token', {
        name: 'Test Room',
        isPublic: true
      });

      expect(store.error).toBe('Already in a room. Leave current room first.');
    });

    it('clears error at start', async () => {
      const store = useSyncPlayStore();
      // @ts-expect-error - setting directly for test
      store.error = 'Previous error';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true, group: { group_id: 'room-1', group_name: 'Test' } })
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true, group: { group_id: 'room-1', group_name: 'Test' } })
      });

      await store.createAndJoinRoom('https://api.example.com', 'token', {
        name: 'Test Room',
        isPublic: true
      });

      expect(store.error).toBeNull();
    });
  });

  describe('leaveRoom', () => {
    it('does nothing if no current room', async () => {
      const store = useSyncPlayStore();
      await expect(store.leaveRoom('https://api.example.com', 'token')).resolves.toBeUndefined();
    });

    it('clears state after leaving', async () => {
      const store = useSyncPlayStore();
      // @ts-expect-error - setting directly for test
      store.currentRoom = { id: 'room-1' };
      // @ts-expect-error - setting directly for test
      store.currentSession = { id: 'session-1' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true, message: 'Left the group' })
      });

      await store.leaveRoom('https://api.example.com', 'token');

      expect(store.currentRoom).toBeNull();
      expect(store.currentSession).toBeNull();
      expect(store.members).toEqual([]);
    });
  });

  describe('sendCommand', () => {
    it('does nothing if no session', async () => {
      const store = useSyncPlayStore();
      await expect(
        store.sendCommand('https://api.example.com', 'token', 'play')
      ).resolves.toBeUndefined();
    });

    it('does nothing when the WebSocket client is not connected', async () => {
      const store = useSyncPlayStore();
      // @ts-expect-error - setting directly for test
      store.currentSession = { id: 'session-1', createdBy: 'user-123' };
      const sendPlaySpy = vi.spyOn(SyncPlayClient.prototype, 'sendPlay');

      await store.sendCommand('https://api.example.com', 'token', 'play', { position: 100 });

      expect(sendPlaySpy).not.toHaveBeenCalled();
    });

    it('dispatches play through the WebSocket client, converting seconds to ms at the send boundary', async () => {
      const store = useSyncPlayStore();
      store.connectWs('https://api.example.com', 'room-1', 'token');
      // @ts-expect-error - setting directly for test
      store.currentSession = { id: 'session-1', createdBy: 'user-123' };
      const sendPlaySpy = vi.spyOn(SyncPlayClient.prototype, 'sendPlay');

      await store.sendCommand('https://api.example.com', 'token', 'play', { position: 337 });

      expect(sendPlaySpy).toHaveBeenCalledTimes(1);
      expect(sendPlaySpy).toHaveBeenCalledWith(337_000);
      // The REST command route does not exist in v0.99.0 — playback transport is the WebSocket only.
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('dispatches pause with the position converted to ms', async () => {
      const store = useSyncPlayStore();
      store.connectWs('https://api.example.com', 'room-1', 'token');
      // @ts-expect-error - setting directly for test
      store.currentSession = { id: 'session-1', createdBy: 'user-123' };
      const sendPauseSpy = vi.spyOn(SyncPlayClient.prototype, 'sendPause');

      await store.sendCommand('https://api.example.com', 'token', 'pause', { position: 337 });

      expect(sendPauseSpy).toHaveBeenCalledWith(337_000);
    });

    it('dispatches seek as from-position -> to-position in ms', async () => {
      const store = useSyncPlayStore();
      store.connectWs('https://api.example.com', 'room-1', 'token');
      // @ts-expect-error - setting directly for test
      store.currentSession = { id: 'session-1', createdBy: 'user-123' };
      const sendSeekSpy = vi.spyOn(SyncPlayClient.prototype, 'sendSeek');

      await store.sendCommand('https://api.example.com', 'token', 'seek', { position: 337 });

      expect(sendSeekSpy).toHaveBeenCalledWith(0, 337_000);
    });

    it('dispatches sync through reportPosition with the position in ms', async () => {
      const store = useSyncPlayStore();
      store.connectWs('https://api.example.com', 'room-1', 'token');
      // @ts-expect-error - setting directly for test
      store.currentSession = { id: 'session-1', createdBy: 'user-123' };
      const reportPositionSpy = vi.spyOn(SyncPlayClient.prototype, 'reportPosition');

      await store.sendCommand('https://api.example.com', 'token', 'sync', { position: 337, rate: 1.5 });

      expect(reportPositionSpy).toHaveBeenCalledWith(337_000, true);
    });
  });

  describe('refreshState', () => {
    it('does nothing if no session', async () => {
      const store = useSyncPlayStore();
      await expect(store.refreshState('https://api.example.com', 'token')).resolves.toBeUndefined();
    });
  });

  describe('refreshMembers', () => {
    it('does nothing if no room', async () => {
      const store = useSyncPlayStore();
      await expect(store.refreshMembers('https://api.example.com', 'token')).resolves.toBeUndefined();
    });
  });

  describe('fetchPublicRooms', () => {
    it('returns rooms from API', async () => {
      const store = useSyncPlayStore();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          groups: [
            { id: 'room-1', name: 'Room 1', member_count: 2, has_password: false, current_media: 'media-1', is_playing: true },
            { id: 'room-2', name: 'Room 2', member_count: 0, has_password: true, current_media: null, is_playing: false }
          ]
        })
      });

      const rooms = await store.fetchPublicRooms('https://api.example.com', 'token');
      expect(rooms).toHaveLength(2);
      expect(rooms[0]).toMatchObject({
        id: 'room-1',
        name: 'Room 1',
        member_count: 2,
        has_password: false,
        current_media: 'media-1',
        is_playing: true,
      });
    });

    it('handles missing rooms array in response', async () => {
      const store = useSyncPlayStore();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({})
      });

      const rooms = await store.fetchPublicRooms('https://api.example.com', 'token');
      expect(rooms).toEqual([]);
    });
  });

  describe('disconnectWs', () => {
    it('closes WebSocket and clears state', () => {
      const store = useSyncPlayStore();
      // @ts-expect-error - setting directly for test
      store.wsConnection = new MockWebSocket() as any;
      store.disconnectWs();
      expect(store.wsConnected).toBe(false);
      expect(store.wsReconnecting).toBe(false);
    });
  });

  describe('connectWs', () => {
    it('does not throw when called with valid parameters', () => {
      const store = useSyncPlayStore();
      expect(() => store.connectWs('https://api.example.com', 'room-123', 'token-abc')).not.toThrow();
    });

    it('returns early if already connected to same room', () => {
      const store = useSyncPlayStore();
      // @ts-expect-error - setting directly for test
      store.currentRoom = { id: 'room-123' };
      // @ts-expect-error - setting directly for test
      store.wsConnection = { readyState: 1 } as any;

      // This should return early without error
      expect(() => store.connectWs('https://api.example.com', 'room-123', 'token-abc')).not.toThrow();
    });
  });
});
