/**
 * useTrackPreferenceStore (S511 / AD-18) — the settings bridge + per-item memory.
 *
 * The store is the ONLY place in the tizen client that talks to the account
 * language preferences, so this file pins the wire contract it depends on:
 *   - AC3 (existing endpoints only): reads via `GET /api/v1/users/me/settings`
 *     and writes via `PUT /api/v1/users/me/settings` with a SINGLE whitelisted
 *     language field — the whole `{method,url,body}` tuple is asserted, because
 *     the server's partial `updateSettings()` merge keys off exactly that field
 *     name (`preferred_audio_language` / `preferred_subtitle_language`).
 *   - fail-soft by contract: a rejected settings fetch leaves the account
 *     preference `null` (the ladder then behaves as "absent"); a rejected PUT
 *     still keeps the per-item memory + in-session state.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useTrackPreferenceStore, PER_ITEM_SLOT_CAP } from '@/stores/useTrackPreferenceStore';

const apiCalls: { method: string; url: string; body?: unknown }[] = [];
let getResponse: unknown = { settings: {} };
let getShouldThrow = false;
let putShouldThrow = false;
/**
 * w13: RT-085 gate — while set, every mock PUT awaits this promise before
 * doing anything, so tests can hold a write in flight and fire rapid
 * follow-up `persist()` calls at it (the storm the cure must collapse).
 */
let putGate: Promise<void> | null = null;

vi.mock('@phlix/ui', () => ({
  ApiClient: class {
    constructor(_opts: unknown) {}
    async get<T = unknown>(url: string): Promise<T> {
      apiCalls.push({ method: 'GET', url });
      if (getShouldThrow) throw new Error('network down');
      return getResponse as T;
    }
    async put<T = unknown>(url: string, body?: unknown): Promise<T> {
      if (putGate) await putGate;
      apiCalls.push({ method: 'PUT', url, body });
      if (putShouldThrow) throw new Error('403');
      return { message: 'Settings updated' } as T;
    }
  },
}));

describe('useTrackPreferenceStore — AC3 settings read/write contract', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiCalls.length = 0;
    getResponse = { settings: {} };
    getShouldThrow = false;
    putShouldThrow = false;
    globalThis.localStorage.clear();
  });

  it('load() GETs the settings route and parses both account languages', async () => {
    getResponse = {
      settings: { preferred_audio_language: 'eng', preferred_subtitle_language: 'spa' },
    };
    const store = useTrackPreferenceStore();
    await store.load('http://server.test');

    expect(apiCalls).toEqual([{ method: 'GET', url: '/api/v1/users/me/settings' }]);
    expect(store.preferredAudio).toBe('eng');
    expect(store.preferredSubtitle).toBe('spa');
    expect(store.loaded).toBe(true);
  });

  it('load() is fail-soft — a rejected fetch clears the account preference to null', async () => {
    getShouldThrow = true;
    const store = useTrackPreferenceStore();
    await store.load('http://server.test');

    expect(store.preferredAudio).toBeNull();
    expect(store.preferredSubtitle).toBeNull();
    expect(store.loaded).toBe(true);
  });

  it('load() maps a settings-less body to null (server absent → ladder absent)', async () => {
    getResponse = {};
    const store = useTrackPreferenceStore();
    await store.load('http://server.test');
    expect(store.preferredAudio).toBeNull();
    expect(store.preferredSubtitle).toBeNull();
  });

  it('persist() PUTs exactly one whitelisted language field (partial-merge safe)', async () => {
    const store = useTrackPreferenceStore();
    await store.persist('http://server.test', 'media-9', 'audio', 'fra');

    expect(apiCalls).toEqual([
      { method: 'PUT', url: '/api/v1/users/me/settings', body: { preferred_audio_language: 'fra' } },
    ]);
    // In-session state reflects the choice immediately.
    expect(store.preferredAudio).toBe('fra');
    // And it is remembered per-item for the next visit.
    expect(store.getPerItem('media-9', 'audio')).toBe('fra');
  });

  it('persist("subtitle") targets preferred_subtitle_language', async () => {
    const store = useTrackPreferenceStore();
    await store.persist('http://server.test', 'media-9', 'subtitle', 'kor');
    expect(apiCalls[0].body).toEqual({ preferred_subtitle_language: 'kor' });
    expect(store.preferredSubtitle).toBe('kor');
  });

  it('persist() keeps the per-item memory even when the account PUT fails', async () => {
    putShouldThrow = true;
    const store = useTrackPreferenceStore();
    const settled = await store.persist('http://server.test', 'media-42', 'audio', 'jpn');

    // No throw escaped; local memory + in-session state survived the failure.
    expect(store.getPerItem('media-42', 'audio')).toBe('jpn');
    expect(store.preferredAudio).toBe('jpn');
    // w13: RT-085 — the failure is DISCLOSED, not swallowed silently.
    expect(settled).toBe(false);
  });
});

describe('useTrackPreferenceStore — RT-085 latest-wins write coalescing', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiCalls.length = 0;
    getResponse = { settings: {} };
    getShouldThrow = false;
    putShouldThrow = false;
    putGate = null;
    globalThis.localStorage.clear();
  });
  afterEach(() => {
    putGate = null;
  });

  it('rapid picks on one slot collapse to in-flight PUT + one latest follow-up', async () => {
    const store = useTrackPreferenceStore();
    let release!: () => void;
    putGate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = store.persist('http://server.test', 'media-7', 'audio', 'eng');
    // Two more choices while the first PUT is still in flight: each queues
    // only its newest value into the ONE live drain (pinia hands every caller
    // its own promise wrapper, so coalescing is proven by the wire, not by
    // object identity — see the request-count assertion below).
    const second = store.persist('http://server.test', 'media-7', 'audio', 'spa');
    const third = store.persist('http://server.test', 'media-7', 'audio', 'fra');

    expect(apiCalls.filter((c) => c.method === 'PUT')).toHaveLength(0); // gate holds
    release();
    const [s1, s2, s3] = await Promise.all([first, second, third]);
    expect(s1).toBe(true);
    expect(s2).toBe(true);
    expect(s3).toBe(true);

    const bodies = apiCalls.filter((c) => c.method === 'PUT').map((c) => c.body);
    // The already-sent request carries 'eng'; exactly ONE follow-up carries the
    // final pick 'fra'. Three clicks — two requests, account ends on 'fra'.
    expect(bodies).toEqual([
      { preferred_audio_language: 'eng' },
      { preferred_audio_language: 'fra' },
    ]);
    // (s1, s2, s3 are the coalesced drain's single promise — all three callers
    // observe the LATEST write's outcome, asserted true above.)
    expect(store.getPerItem('media-7', 'audio')).toBe('fra');
  });

  it('resolves false when the follow-up write for the latest pick fails', async () => {
    const store = useTrackPreferenceStore();
    let release!: () => void;
    putGate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const running = store.persist('http://server.test', 'media-7', 'audio', 'eng');
    void store.persist('http://server.test', 'media-7', 'audio', 'spa');
    release();
    putShouldThrow = true; // both PUTs throw when they resume from the gate
    const settled = await running;

    expect(settled).toBe(false); // account row is stale → the page must disclose
    expect(store.getPerItem('media-7', 'audio')).toBe('spa'); // local holds newest
  });

  it('different slots keep independent drains', async () => {
    const store = useTrackPreferenceStore();
    let release!: () => void;
    putGate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const audio = store.persist('http://server.test', 'media-7', 'audio', 'eng');
    const subtitle = store.persist('http://server.test', 'media-7', 'subtitle', 'spa');
    expect(subtitle).not.toBe(audio); // (kind, itemId) slots never merge
    release();

    expect(await audio).toBe(true);
    expect(await subtitle).toBe(true);
    const urls = apiCalls.filter((c) => c.method === 'PUT');
    expect(urls).toHaveLength(2);
  });

  it('a later pick after a settled drain starts a fresh write', async () => {
    const store = useTrackPreferenceStore();
    expect(await store.persist('http://server.test', 'media-7', 'audio', 'eng')).toBe(true);
    expect(await store.persist('http://server.test', 'media-7', 'audio', 'fra')).toBe(true);
    const bodies = apiCalls.filter((c) => c.method === 'PUT').map((c) => c.body);
    expect(bodies).toEqual([
      { preferred_audio_language: 'eng' },
      { preferred_audio_language: 'fra' },
    ]);
  });
});

describe('useTrackPreferenceStore — per-item memory (localStorage slot)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiCalls.length = 0;
    getShouldThrow = false;
    putShouldThrow = false;
    globalThis.localStorage.clear();
  });

  it('getPerItem is null until a choice is stored', () => {
    const store = useTrackPreferenceStore();
    expect(store.getPerItem('media-1', 'audio')).toBeNull();
  });

  it('setPerItem round-trips, and an empty language clears the slot', () => {
    const store = useTrackPreferenceStore();
    store.setPerItem('media-1', 'subtitle', 'spa');
    expect(store.getPerItem('media-1', 'subtitle')).toBe('spa');
    store.setPerItem('media-1', 'subtitle', null);
    expect(store.getPerItem('media-1', 'subtitle')).toBeNull();
  });

  it('audio and subtitle slots are independent per item', () => {
    const store = useTrackPreferenceStore();
    store.setPerItem('media-1', 'audio', 'eng');
    store.setPerItem('media-1', 'subtitle', 'fra');
    expect(store.getPerItem('media-1', 'audio')).toBe('eng');
    expect(store.getPerItem('media-1', 'subtitle')).toBe('fra');
  });
});

describe('useTrackPreferenceStore — resolveDefault runs the ladder over stored layers', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiCalls.length = 0;
    getShouldThrow = false;
    putShouldThrow = false;
    globalThis.localStorage.clear();
  });

  it('per-item memory beats the loaded account preference', async () => {
    getResponse = { settings: { preferred_audio_language: 'eng' } };
    const store = useTrackPreferenceStore();
    await store.load('http://server.test');
    store.setPerItem('media-7', 'audio', 'spa');

    const r = store.resolveDefault('media-7', 'audio', ['eng', 'spa']);
    expect(r).toEqual({ language: 'spa', source: 'per-item' });
  });

  it('with no per-item memory the account preference applies', async () => {
    getResponse = { settings: { preferred_subtitle_language: 'fra' } };
    const store = useTrackPreferenceStore();
    await store.load('http://server.test');

    const r = store.resolveDefault('media-8', 'subtitle', ['eng', 'fra']);
    expect(r).toEqual({ language: 'fra', source: 'server' });
  });

  it('absent everything (no fetch, no memory) → null (AC2 unchanged behaviour)', () => {
    const store = useTrackPreferenceStore();
    const r = store.resolveDefault('media-9', 'audio', ['eng', 'spa']);
    expect(r).toEqual({ language: null, source: 'none' });
  });
});

// w12: RT-084 — the LRU cap + quota-fail-soft contract. These tests import the
// cap constant so a silent drift of the number itself reddens here. They run on
// a scripted fake store (the repo's shared test-setup mock has no key()/length
// enumeration and cannot fail on demand), swapped in through the mock's own
// writable `localStorage` data property — never defineProperty (it is
// non-configurable there).
describe('useTrackPreferenceStore — RT-084 LRU cap + quota fail-soft', () => {
  const slotKey = (id: string): string => `phlix.trackPref.audio.${id}`;
  const INDEX = 'phlix.trackPref.index';

  /** Storage double: real enumeration + scripted write failures. */
  class FakeStore {
    readonly map = new Map<string, string>();
    /** Number of upcoming SLOT-key writes that throw before succeeding again. */
    failNextWrites = 0;
    /** When true every slot write throws (permanently dead store leg). */
    failForever = false;

    getItem(key: string): string | null {
      return this.map.get(key) ?? null;
    }
    setItem(key: string, value: string): void {
      const isSlot = key.startsWith('phlix.trackPref.') && key !== INDEX;
      if (isSlot && (this.failForever || this.failNextWrites > 0)) {
        if (!this.failForever) this.failNextWrites -= 1;
        throw new Error('QuotaExceededError');
      }
      this.map.set(key, value);
    }
    removeItem(key: string): void {
      this.map.delete(key);
    }
    key(index: number): string | null {
      return [...this.map.keys()][index] ?? null;
    }
    get length(): number {
      return this.map.size;
    }
    liveSlots(): string[] {
      return [...this.map.keys()].filter((k) => k.startsWith('phlix.trackPref.') && k !== INDEX);
    }
    index(): string[] {
      const raw = this.map.get(INDEX);
      return raw === undefined ? [] : (JSON.parse(raw) as string[]);
    }
  }

  let fake = new FakeStore();
  const original = globalThis.localStorage;

  beforeEach(() => {
    setActivePinia(createPinia());
    apiCalls.length = 0;
    fake = new FakeStore();
    globalThis.localStorage = fake as unknown as Storage;
  });
  afterEach(() => {
    globalThis.localStorage = original;
  });

  it('writes past the cap evict the oldest slots and keep the index at cap', () => {
    const store = useTrackPreferenceStore();
    for (let i = 0; i <= PER_ITEM_SLOT_CAP; i++) {
      store.setPerItem(`media-${i}`, 'audio', 'eng');
    }
    const live = fake.liveSlots();
    expect(live).toHaveLength(PER_ITEM_SLOT_CAP);
    expect(live).not.toContain(slotKey('media-0')); // oldest gone
    expect(live).toContain(slotKey(`media-${PER_ITEM_SLOT_CAP}`)); // newest survives
    const index = fake.index();
    expect(index).toHaveLength(PER_ITEM_SLOT_CAP);
    expect(index[0]).toBe(slotKey(`media-${PER_ITEM_SLOT_CAP}`)); // most-recent-first
  });

  it('re-writing an old slot promotes it to the front of the LRU index', () => {
    const store = useTrackPreferenceStore();
    for (const id of ['a', 'b', 'c']) store.setPerItem(id, 'audio', 'eng');
    expect(fake.index()[2]).toBe(slotKey('a'));
    store.setPerItem('a', 'audio', 'fra'); // same item, new language → front
    expect(fake.index()[0]).toBe(slotKey('a'));
    expect(store.getPerItem('a', 'audio')).toBe('fra');
  });

  it('a full live-set survives index corruption by re-deriving via enumeration', () => {
    // Seed 100 slots behind the store's back, then poison the index.
    for (let i = 0; i < PER_ITEM_SLOT_CAP; i++) fake.map.set(slotKey(`seed-${i}`), 'eng');
    fake.map.set(INDEX, '{"corrupt":true}');

    const store = useTrackPreferenceStore();
    store.setPerItem('fresh', 'audio', 'spa');

    expect(store.getPerItem('fresh', 'audio')).toBe('spa');
    const index = fake.index();
    expect(index[0]).toBe(slotKey('fresh')); // rebuilt + front-promoted
    expect(index).toHaveLength(PER_ITEM_SLOT_CAP);
    expect(fake.liveSlots()).toHaveLength(PER_ITEM_SLOT_CAP);
    expect(fake.map.get(slotKey('seed-99'))).toBeUndefined(); // oldest evicted
  });

  it('a write rejected by quota evicts to half-cap and the single retry succeeds', () => {
    for (let i = 0; i < PER_ITEM_SLOT_CAP; i++) fake.map.set(slotKey(`old-${i}`), 'eng');
    fake.map.set(INDEX, JSON.stringify([...Array(PER_ITEM_SLOT_CAP).keys()].map((i) => slotKey(`old-${i}`))));
    fake.failNextWrites = 1; // the first slot write throws, retry lands

    const store = useTrackPreferenceStore();
    store.setPerItem('new', 'audio', 'kor'); // must not propagate the throw

    expect(fake.map.get(slotKey('new'))).toBe('kor');
    // Half-cap recovery: 50 survivors kept, then the new head → 51 live slots.
    expect(fake.liveSlots()).toHaveLength(Math.floor(PER_ITEM_SLOT_CAP / 2) + 1);
    expect(fake.index()[0]).toBe(slotKey('new'));
  });

  it('a permanently rejecting store cannot throw out of setPerItem (fail-soft law)', () => {
    fake.map.set(slotKey('keep'), 'eng');
    fake.failForever = true;

    const store = useTrackPreferenceStore();
    expect(() => store.setPerItem('dead', 'audio', 'fra')).not.toThrow();
    expect(store.getPerItem('dead', 'audio')).toBeNull(); // value never landed
  });

  it('clearing a choice removes it from both storage and the LRU index', () => {
    const store = useTrackPreferenceStore();
    store.setPerItem('x', 'audio', 'eng');
    store.setPerItem('x', 'audio', null);
    expect(fake.map.get(slotKey('x'))).toBeUndefined();
    expect(fake.index()).not.toContain(slotKey('x'));
  });
});
