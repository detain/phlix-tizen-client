import { describe, it, expect } from 'vitest';
import {
  resolveAppConfig,
  readAddressHistory,
  pushAddressHistory,
  buildConnectSuggestions,
  isAllowedServerAddress,
  sanitizeServerAddress,
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

// ===========================================================================
// M-TIZEN-07 (review tizen__exploiter M2) — scheme allow-list at the storage
// boundary. The persisted server/hub address rides the bearer credential, so
// an absolute non-http(s) scheme must be refused at EVERY edge: writes to the
// slot/history, the resolve-time read of the slot, and the legacy-poisoned
// entries already sitting in storage from before the cure.
// ===========================================================================

describe('M-TIZEN-07 isAllowedServerAddress — scheme-class table', () => {
  const FORBIDDEN: readonly string[] = [
    'javascript:alert(1)',
    'JavaScript:alert(1)', // uppercase scheme must not smuggle the class
    'JAVASCRIPT:alert(1)',
    '  javascript:alert(1)  ', // surrounding space (trim-first defense)
    'java\tscript:alert(1)', // embedded tab — the WHATWG parser STRIPS it,
    'java\nscript:alert(1)', // so parsing (not a regex) catches the trick
    'data:text/html,<script>steal()</script>',
    'DATA:text/plain,hello',
    'file:///etc/passwd',
    'FILE://C:/evil',
    'ws://evil.test:8097', // raw ws: at the storage boundary (the relay BUILDS
    'wss://evil.test:8804', // ws(s) itself from an https base — M-TIZEN-06 law)
    'WS://evil.test',
    'blob:https://evil.test/uuid',
    'vbscript:msgbox',
    'about:blank',
    'mailto:h@evil.test',
  ];
  for (const raw of FORBIDDEN) {
    it(`refuses the absolute non-http(s) scheme: ${JSON.stringify(raw)}`, () => {
      expect(isAllowedServerAddress(raw)).toBe(false);
      expect(sanitizeServerAddress(raw)).toBeNull();
    });
  }

  const ACCEPTED: readonly string[] = [
    'http://192.168.1.40:8097',
    'https://tv.example.test',
    'HTTP://Upper-Case-Still-Http:8096', // uppercase of an ALLOWED class stays allowed
    'HTTPS://Upper:8096',
    '  http://padded:8096  ', // whitespace-padded http is still http
    '/phlix', // relative base — existing semantics preserved
    'not a url at all', // scheme-less garbage — existing semantics preserved
    '192.168.1.5:8096', // scheme-less host:port — existing semantics preserved
  ];
  for (const raw of ACCEPTED) {
    it(`accepts (http(s), or non-absolute pass-through): ${JSON.stringify(raw)}`, () => {
      expect(isAllowedServerAddress(raw)).toBe(true);
      expect(sanitizeServerAddress(raw)).toBe(raw.trim());
    });
  }

  it('sanitize passes null/undefined through and keeps blank slots blank (not null)', () => {
    expect(sanitizeServerAddress(null)).toBeNull();
    expect(sanitizeServerAddress(undefined)).toBeNull();
    expect(sanitizeServerAddress('')).toBe('');
    expect(sanitizeServerAddress('   ')).toBe('');
  });
});

describe('M-TIZEN-07 resolveAppConfig — defensive normalization at the resolve edge', () => {
  it('a legacy-poisoned persisted base falls through to the build-time env URL', () => {
    const result = resolveAppConfig({
      serverUrl: 'javascript:alert(1)',
      envUrl: 'http://env-server:8096'
    });
    expect(result).toEqual({ app: 'server', apiBase: 'http://env-server:8096' });
  });

  it('a legacy-poisoned persisted base with no env URL resolves to the EMPTY base (→ Connect screen)', () => {
    const result = resolveAppConfig({ serverUrl: 'data:text/html,evil', envUrl: null });
    expect(result).toEqual({ app: 'server', apiBase: '' });
  });

  it('a relative persisted base keeps its existing pass-through semantics', () => {
    const result = resolveAppConfig({ serverUrl: '/phlix', envUrl: null });
    expect(result).toEqual({ app: 'server', apiBase: '/phlix' });
  });

  it('a plaintext http LAN base stays valid — the M-TIZEN-06 TLS law lives at the relay DIAL, not at persistence', () => {
    const result = resolveAppConfig({ serverUrl: 'http://192.168.1.5:8096', envUrl: null });
    expect(result).toEqual({ app: 'server', apiBase: 'http://192.168.1.5:8096' });
  });
});

describe('M-TIZEN-07 address history — write gate + legacy-read sanitize', () => {
  it('push refuses every forbidden-scheme class; storage keeps only the clean entry', () => {
    const store = memStore({ [SERVER_HISTORY_KEY]: '["http://a:8096"]' });
    pushAddressHistory(store, 'javascript:alert(1)');
    pushAddressHistory(store, ' JAVASCRIPT:alert(1) ');
    pushAddressHistory(store, 'data:text/html,<script>x</script>');
    pushAddressHistory(store, 'file:///etc/passwd');
    pushAddressHistory(store, 'ws://evil:8097');
    expect(JSON.parse(store.data.get(SERVER_HISTORY_KEY) as string)).toEqual(['http://a:8096']);
  });

  it('read sanitizes legacy-poisoned persisted entries out (the stored-forever class)', () => {
    // 'ws://evil:8097' is the load-bearing case: it carries a HOST, so the
    // engine's own dedup would otherwise keep it — the read gate is the only
    // thing that removes it from the suggestion/probe rail.
    const store = memStore({
      [SERVER_HISTORY_KEY]: JSON.stringify([
        'javascript:alert(1)',
        'http://clean:8096',
        'ws://evil:8097',
        'data:text/html,x',
        '   ',
        'file:///x',
      ]),
    });
    expect(readAddressHistory(store)).toEqual(['http://clean:8096']);
  });

  it('the slot self-heals: the next clean connect rewrites storage THROUGH the read filter', () => {
    const store = memStore({
      [SERVER_HISTORY_KEY]: JSON.stringify(['ws://evil:8097', 'http://old:8096']),
    });
    pushAddressHistory(store, 'http://new:8096');
    expect(JSON.parse(store.data.get(SERVER_HISTORY_KEY) as string)).toEqual([
      'http://new:8096',
      'http://old:8096',
    ]);
  });

  it('buildConnectSuggestions never surfaces a poisoned legacy entry', () => {
    const store = memStore({
      [SERVER_HISTORY_KEY]: JSON.stringify(['ws://evil:8097', 'http://ok:8096']),
    });
    expect(buildConnectSuggestions(store)).toEqual(['http://ok:8096']);
  });
});
