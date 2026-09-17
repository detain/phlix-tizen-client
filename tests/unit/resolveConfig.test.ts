import { describe, it, expect } from 'vitest';
import {
  resolveAppConfig,
  readAddressHistory,
  pushAddressHistory,
  buildConnectSuggestions,
  SERVER_HISTORY_KEY,
  ADDRESS_HISTORY_CAP,
  CONNECT_SUGGESTION_CAP,
} from '@/resolveConfig';

/** A minimal in-memory SuggestionStorage stand-in for the history tests. */
function memStore(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    data,
  };
}

describe('resolveAppConfig', () => {
  it('uses the persisted server URL in server mode', () => {
    const result = resolveAppConfig({
      serverUrl: 'http://my-server:8096',
      envUrl: 'http://env-server:8096'
    });
    expect(result).toEqual({ app: 'server', apiBase: 'http://my-server:8096' });
  });

  it('falls back to the env URL when no persisted server URL', () => {
    const result = resolveAppConfig({ serverUrl: null, envUrl: 'http://env-server:8096' });
    expect(result).toEqual({ app: 'server', apiBase: 'http://env-server:8096' });
  });

  it('falls back to an EMPTY base when nothing else is set (→ Connect screen)', () => {
    // No localhost guess: an empty base signals main.ts/@phlix/ui to show the
    // first-run Connect screen rather than authenticate against nothing.
    const result = resolveAppConfig({ serverUrl: null, envUrl: null });
    expect(result).toEqual({ app: 'server', apiBase: '' });
  });

  it('treats an empty string server URL as unset (→ empty base)', () => {
    const result = resolveAppConfig({ serverUrl: '', envUrl: '' });
    expect(result).toEqual({ app: 'server', apiBase: '' });
  });
});

describe('S529 connect suggestions (address-history → bounded suggestion list)', () => {
  it('empty / corrupt history reads as [] (never throws, never fabricates)', () => {
    expect(readAddressHistory(memStore())).toEqual([]);
    expect(readAddressHistory(null)).toEqual([]);
    expect(readAddressHistory(memStore({ [SERVER_HISTORY_KEY]: 'not json' }))).toEqual([]);
    expect(readAddressHistory(memStore({ [SERVER_HISTORY_KEY]: '{"a":1}' }))).toEqual([]);
  });

  it('push prepends most-recent-first and de-dupes by host (a re-connect refreshes)', () => {
    const store = memStore();
    pushAddressHistory(store, 'http://a:8096');
    pushAddressHistory(store, 'http://b:8096');
    pushAddressHistory(store, 'http://a:8096/'); // same host as the first entry
    const history = JSON.parse(store.data.get(SERVER_HISTORY_KEY) as string) as string[];
    expect(history).toEqual(['http://a:8096', 'http://b:8096']); // a moved to front, no dup
  });

  it('caps the persisted history at ADDRESS_HISTORY_CAP distinct hosts', () => {
    const store = memStore();
    for (let i = 0; i < ADDRESS_HISTORY_CAP + 4; i += 1) pushAddressHistory(store, `http://h${i}:8096`);
    const history = JSON.parse(store.data.get(SERVER_HISTORY_KEY) as string) as string[];
    expect(history.length).toBe(ADDRESS_HISTORY_CAP);
    expect(history[0]).toBe(`http://h${ADDRESS_HISTORY_CAP + 3}:8096`); // newest first
  });

  it('ignores blank pushes (a null disconnect must not poison history)', () => {
    const store = memStore({ [SERVER_HISTORY_KEY]: '["http://a:8096"]' });
    pushAddressHistory(store, '   ');
    expect(JSON.parse(store.data.get(SERVER_HISTORY_KEY) as string)).toEqual(['http://a:8096']);
  });

  it('buildConnectSuggestions bounds the surfaced list at CONNECT_SUGGESTION_CAP', () => {
    const store = memStore();
    for (let i = 0; i < ADDRESS_HISTORY_CAP; i += 1) pushAddressHistory(store, `http://h${i}:8096`);
    const suggestions = buildConnectSuggestions(store);
    expect(suggestions.length).toBe(Math.min(CONNECT_SUGGESTION_CAP, ADDRESS_HISTORY_CAP));
    expect(buildConnectSuggestions(memStore())).toEqual([]);
  });
});
