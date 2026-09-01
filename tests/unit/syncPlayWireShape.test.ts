import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSyncPlayStore } from '@/stores/useSyncPlayStore';

/**
 * S415 (s279b) — the tizen syncplay store must adopt the WIRE shape the
 * server actually emits, typed by @phlix/contracts v0.4.6: the group state
 * carries `group_id`/`group_name` + a DICT `members` (keyed by member id),
 * and the list-row vocabulary (`id`/`name`/`has_password`/`current_media`/
 * `is_playing`) belongs to list rows only.
 *
 * The payload below is COPIED VERBATIM from
 * phlix-contracts `test/fixtures/syncplay-envelope-vectors.json` rail
 * `joinGroup` — the real `{success, group}` response captured from
 * phlix-server `01340633`'s SyncPlayController by
 * `scripts/dump-server-syncplay-vectors.php` (S345 law: real emitter, no
 * mocks-of-own-shape). Before the S415 cascade, `normalizeGroup` SYNTHESIZED
 * the untrue shape (id/name/has_password/…) and array-wrapped members; these
 * pins reddened under that implementation and hold the honest one.
 */

// @ts-expect-error - test-local fetch mock, mirrors useSyncPlayStore.test.ts
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const JOIN_ENVELOPE = {
  success: true,
  group: {
    group_id: 'sp_cca927fbf4ba11f9',
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

/** The LIST row spelling as the real snapshot service emits it (same provenance). */
const LIST_ROW = {
  id: 'sp_cca927fbf4ba11f9',
  name: 'Movie Night',
  member_count: 2,
  has_password: true,
  current_media: null,
  is_playing: false,
};

describe('syncPlayWireShape (S415)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('joinRoom maps the REAL {success, group} envelope to the honest state shape', async () => {
    const store = useSyncPlayStore();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(JOIN_ENVELOPE),
    });

    await store.joinRoom('https://api.example.com', 'token', 'sp_cca927fbf4ba11f9');

    const room = store.currentRoom;
    expect(room).not.toBeNull();
    // State vocabulary — exact key set, no synthesized list-row keys.
    expect(Object.keys(room!).sort()).toEqual(
      [
        'created_at',
        'current_media_duration',
        'current_media_id',
        'group_id',
        'group_name',
        'host_id',
        'last_activity_at',
        'member_count',
        'members',
        'playback_position',
        'playback_state',
        'queue',
      ].sort(),
    );
    expect(room!.group_id).toBe('sp_cca927fbf4ba11f9');
    expect(room!.group_name).toBe('Movie Night');

    // members is a DICT keyed by member id — NOT an array.
    expect(Array.isArray(room!.members), 'members must stay a dict').toBe(false);
    expect(Object.keys(room!.members).sort()).toEqual(['member_guest', 'member_host']);
    expect(room!.members.member_host).toEqual({
      id: 'member_host',
      name: 'Host One',
      is_host: true,
      joined_at: 1788300111,
    });

    // The store-level user view still sees both members (dict → presence list).
    expect(store.members.map((m) => m.id).sort()).toEqual(['member_guest', 'member_host']);
    expect(store.members.find((m) => m.id === 'member_host')!.role).toBe('owner');
    expect(store.members.find((m) => m.id === 'member_guest')!.isOnline).toBe(true);

    // Session view: the group IS the session.
    expect(store.currentSession?.id).toBe('sp_cca927fbf4ba11f9');
    expect(store.currentSession?.createdBy).toBe('member_host');
  });

  it('fetchPublicRooms maps LIST rows with the list vocabulary (no state keys invented)', async () => {
    const store = useSyncPlayStore();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ groups: [LIST_ROW] }),
    });

    const rows = await store.fetchPublicRooms('https://api.example.com', 'token');

    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(
      ['current_media', 'has_password', 'id', 'is_playing', 'member_count', 'name'].sort(),
    );
    expect(rows[0].has_password).toBe(true);
    expect(rows[0]).not.toHaveProperty('group_id');
    expect(rows[0]).not.toHaveProperty('members');
  });

  it('planted-broken guard: a room built from a LIST row alone does not masquerade state members', async () => {
    // If someone re-folds list rows through normalizeGroup's fiction, an
    // `is_public`/`id` read on the room would work again. It must NOT.
    const store = useSyncPlayStore();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(JOIN_ENVELOPE),
    });
    await store.joinRoom('https://api.example.com', 'token', 'sp_cca927fbf4ba11f9');
    expect(store.currentRoom).not.toHaveProperty('id');
    expect(store.currentRoom).not.toHaveProperty('name');
    expect(store.currentRoom).not.toHaveProperty('has_password');
    expect(store.currentRoom).not.toHaveProperty('is_playing');
    expect(store.currentRoom).not.toHaveProperty('current_media');
  });
});
