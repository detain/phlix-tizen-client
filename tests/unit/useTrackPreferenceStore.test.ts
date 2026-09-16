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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useTrackPreferenceStore } from '@/stores/useTrackPreferenceStore';

const apiCalls: { method: string; url: string; body?: unknown }[] = [];
let getResponse: unknown = { settings: {} };
let getShouldThrow = false;
let putShouldThrow = false;

vi.mock('@phlix/ui', () => ({
  ApiClient: class {
    constructor(_opts: unknown) {}
    async get<T = unknown>(url: string): Promise<T> {
      apiCalls.push({ method: 'GET', url });
      if (getShouldThrow) throw new Error('network down');
      return getResponse as T;
    }
    async put<T = unknown>(url: string, body?: unknown): Promise<T> {
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
    await store.persist('http://server.test', 'media-42', 'audio', 'jpn');

    // No throw escaped; local memory + in-session state survived the failure.
    expect(store.getPerItem('media-42', 'audio')).toBe('jpn');
    expect(store.preferredAudio).toBe('jpn');
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
