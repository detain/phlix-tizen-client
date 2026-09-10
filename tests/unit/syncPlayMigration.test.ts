import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
// Value import: the real runtime key list the package ships (NOT re-derived here).
import { SYNC_PLAY_GROUP_KEYS } from '@phlix/contracts';
// Type import: both spellings are imported deliberately — `SyncPlayRoom` is the
// @deprecated alias of `SyncPlayGroup` at @phlix/contracts v0.4.6 (the S353 rename).
import type { SyncPlayGroup, SyncPlayRoom } from '@phlix/contracts';
import { useSyncPlayStore } from '@/stores/useSyncPlayStore';

/**
 * S353 (lane s353tizen, W52) — SyncPlay migration pin for the re-pin to
 * `@phlix/contracts` v0.4.6 + `@phlix/ui` v0.99.1 (+ `@phlix/syncplay` v0.1.4).
 *
 * The step block filed 2026-08-24 named v0.4.3/v0.99.0; the estate moved past
 * that. These pins check the migrated `useSyncPlayStore` against the REAL
 * runtime vocabulary the installed package exports (`SYNC_PLAY_GROUP_KEYS`) —
 * code wins, not the block's prose. They complement (do not duplicate)
 * `syncPlayWireShape.test.ts` (S415 envelope normalization) and
 * `useSyncPlayStore.test.ts` (command dispatch): the unique coverage here is
 *   1. the store's room view key-set is EXACTLY the contract's live key list,
 *   2. the vocabulary is snake_case — `current_media_id` present, the old
 *      camelCase/`current_media` state spellings absent,
 *   3. `SyncPlayRoom` is a structural alias of `SyncPlayGroup` (the rename),
 *   4. `joinRoom` yields BOTH the room AND the session from one `{group}`
 *      envelope (the v0.99.0 join contract),
 *   5. the whole create→join→send lifecycle speaks only `/syncplay/groups` —
 *      no `/rooms`, no REST `/command` route (v0.99.0 removed `sendCommand`).
 *
 * Payloads are copied verbatim from the join envelope in
 * `syncPlayWireShape.test.ts`, itself captured from phlix-server
 * `01340633`'s `SyncPlayController` (S345 law: real emitter, no mocks-of-own-shape).
 */

// Lane token (manual: code-resident TS string literal const in a test).
const S353_MIGRATION_PROVENANCE = 'S353MIGRATEX7M8' as const;

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

class MockWebSocket {
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  readyState = 1; // OPEN
  close = vi.fn();
  send = vi.fn();
  constructor() {
    /* no-op: the census asserts URL vocabulary, not socket traffic */
  }
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
}
globalThis.WebSocket = MockWebSocket as never;

/** The full `GroupState::getState()` join envelope (snake_case, dict members). */
function joinEnvelope(groupId: string) {
  return {
    success: true,
    group: {
      group_id: groupId,
      group_name: 'Movie Night',
      member_count: 2,
      members: {
        member_host: { id: 'member_host', name: 'Host One', is_host: true, joined_at: 1788300111 },
        member_guest: { id: 'member_guest', name: 'Guest Two', is_host: false, joined_at: 1788300111 },
      },
      host_id: 'member_host',
      current_media_id: null,
      current_media_duration: 0,
      playback_position: 0,
      playback_state: 'stopped',
      queue: [],
      created_at: 1788300111,
      last_activity_at: 1788300111,
    },
  };
}

function fetchUrls(): string[] {
  return mockFetch.mock.calls.map((call) => String(call[0]));
}

describe('syncPlayMigration (S353 re-pin)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records the S353 lane token as a code-resident string literal', () => {
    expect(S353_MIGRATION_PROVENANCE).toBe('S353MIGRATEX7M8');
    expect(typeof S353_MIGRATION_PROVENANCE).toBe('string');
  });

  it('the joined room key-set is EXACTLY the contracts v0.4.6 runtime key list', async () => {
    const store = useSyncPlayStore();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(joinEnvelope('sp_cca927fbf4ba11f9')),
    });

    await store.joinRoom('https://api.example.com', 'token', 'sp_cca927fbf4ba11f9');

    const room = store.currentRoom;
    expect(room).not.toBeNull();
    expect(Object.keys(room!).sort()).toEqual([...SYNC_PLAY_GROUP_KEYS].sort());
  });

  it('the room vocabulary is snake_case: current_media_id present, camelCase/list spellings absent', () => {
    // Pins the block's `currentSession → current_media_id` claim against the
    // REAL exported key list rather than the prose.
    expect(SYNC_PLAY_GROUP_KEYS).toContain('current_media_id');
    expect(SYNC_PLAY_GROUP_KEYS).not.toContain('currentSession');
    expect(SYNC_PLAY_GROUP_KEYS).not.toContain('current_media'); // that is a LIST-row key, not a state key
    expect(SYNC_PLAY_GROUP_KEYS).not.toContain('issuedBy');
  });

  it('`SyncPlayRoom` is a structural alias of `SyncPlayGroup` (the S353 rename)', async () => {
    const store = useSyncPlayStore();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(joinEnvelope('sp_cca927fbf4ba11f9')),
    });
    await store.joinRoom('https://api.example.com', 'token', 'sp_cca927fbf4ba11f9');

    // These assignments only compile because `SyncPlayRoom` and `SyncPlayGroup`
    // are the SAME type in contracts v0.4.6 (`SyncPlayRoom` is @deprecated).
    const group: SyncPlayGroup = store.currentRoom!;
    const aliased: SyncPlayRoom = group;
    const roundTrip: SyncPlayGroup = aliased;

    expect(roundTrip.group_id).toBe('sp_cca927fbf4ba11f9');
    expect('current_media_id' in roundTrip).toBe(true);
  });

  it('joinRoom yields BOTH the room (SyncPlayGroup) and the session from one envelope', async () => {
    const store = useSyncPlayStore();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(joinEnvelope('sp_cca927fbf4ba11f9')),
    });

    await store.joinRoom('https://api.example.com', 'token', 'sp_cca927fbf4ba11f9');

    expect(store.currentRoom).not.toBeNull(); // the room view
    expect(store.currentSession).not.toBeNull(); // the session view
    // The group IS the session — both views share the same id.
    expect(store.currentSession!.id).toBe(store.currentRoom!.group_id);
    expect(store.currentSession!.createdBy).toBe('member_host');
  });

  it('the create→join→send lifecycle speaks only /syncplay/groups (no /rooms, no REST /command)', async () => {
    const store = useSyncPlayStore();
    // create → POST /api/v1/syncplay/groups
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(joinEnvelope('sp_new_group')),
    });
    // join → POST /api/v1/syncplay/groups/{id}/join
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(joinEnvelope('sp_new_group')),
    });

    await store.createAndJoinRoom('https://api.example.com', 'token', {
      name: 'Movie Night',
      isPublic: true,
    });
    store.connectWs('https://api.example.com', 'sp_new_group', 'token');
    // v0.99.0 removed the REST `sendCommand`; playback dispatches over the socket.
    await store.sendCommand('https://api.example.com', 'token', 'play', { position: 5 });

    const urls = fetchUrls();
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toContain('/api/v1/syncplay/groups');
      expect(url).not.toMatch(/\/syncplay\/rooms\b/);
      expect(url).not.toMatch(/\/command\b/);
    }
  });
});
