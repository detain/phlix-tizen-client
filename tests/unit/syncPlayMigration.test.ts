import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
// Value import: the real runtime key list the package ships (NOT re-derived here).
import { SYNC_PLAY_GROUP_KEYS } from '@phlix/contracts';
// Type import: the canonical migrated spelling. `SyncPlayRoom` is a TYPE-ONLY
// @deprecated alias of `SyncPlayGroup` at contracts v0.4.6 (it ships no runtime
// value), so the rename is pinned by the runtime vocabulary the store emits, not
// by a phantom import of the old spelling.
import type { SyncPlayGroup } from '@phlix/contracts';
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
 *   3. `joinRoom` answers BOTH views from a SINGLE request (v0.99.0 join
 *      contract) with the migration's vocabulary split held: the room view
 *      carries the wire snake_case keys, the session view the store's local
 *      camelCase model, and neither spelling leaks into the other.
 *   4. the whole create→join→send lifecycle speaks only `/syncplay/groups` —
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

  it('joinRoom answers both views from ONE request with the room(wire,snake_case) vs session(local,camelCase) vocabulary split', async () => {
    const store = useSyncPlayStore();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(joinEnvelope('sp_cca927fbf4ba11f9')),
    });

    await store.joinRoom('https://api.example.com', 'token', 'sp_cca927fbf4ba11f9');

    // v0.99.0 join contract: a single {group} envelope answers BOTH views — one
    // request, no follow-up member/state fetch (S276: the group IS the session).
    // (syncPlayWireShape pins the room's field VALUES; the distinct claim here is
    // the request count + the two-vocabulary split, which neither existing suite
    // asserts together.)
    expect(mockFetch, 'join must be a single request').toHaveBeenCalledTimes(1);

    // Room view = the wire (contracts) vocabulary: snake_case state keys.
    const room: SyncPlayGroup = store.currentRoom!;
    expect('current_media_id' in room).toBe(true);
    expect('playback_position' in room).toBe(true);
    expect('currentMediaId' in room).toBe(false); // the local spelling must not leak to the wire view

    // Session view = the store's LOCAL camelCase model — the migration's other
    // half. session.id IS the group id; the wire spelling must not leak here.
    const session = store.currentSession!;
    expect(session.id).toBe(room.group_id);
    expect('currentMediaId' in session).toBe(true);
    expect('playbackPosition' in session).toBe(true);
    expect('current_media_id' in session).toBe(false);
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
