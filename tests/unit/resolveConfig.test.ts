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
  resolveCredentialBase,
  isPlaintextCredentialBase,
  CredentialTransportInsecureError,
} from '@/resolveConfig';
import { buildWsUrl, SyncPlayInsecureTransportError } from '@/stores/useSyncPlayStore';
import { buildHubRelayUrl, HubRelayInsecureTransportError } from '@/api/hubRelay';

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

// ---------------------------------------------------------------------------
// M-TIZEN-12 r2 — scheme gate at the RESOLVE BOUNDARY (review tizen__secnet
// M12r2). The M-TIZEN-07 allow-list classifies schemes (http/https survive,
// javascript:/data: are poison); it never asked whether the SURVIVING base is
// about to present CREDENTIAL traffic — so a persisted `http://`-literal
// serverUrl resolved verbatim and main.ts handed it straight to the hub-relay
// fallback. r2 refuses the plaintext base at the boundary for credential
// consumers (the e4d8516 idiom REFUSES, it does not upgrade), sanitizes the
// legacy-poisoned class on read exactly as M-TIZEN-07 does, and leaves the
// ratified LAN-REST persistence law untouched.
// ---------------------------------------------------------------------------
describe('resolveCredentialBase — M-TIZEN-12 r2 resolve-boundary scheme gate', () => {
  it('refuses a planted persisted http:// serverUrl with the named error (reviewer repro as a test)', () => {
    // Red-on-parent: at r1 this same storage value resolved VERBATIM and was
    // fed to the credential-transport consumers — the leak this r2 closes.
    expect(() => resolveCredentialBase({ serverUrl: 'http://nas.lan:8096', envUrl: null })).toThrow(
      CredentialTransportInsecureError,
    );
    let caught: unknown;
    try {
      resolveCredentialBase({ serverUrl: 'http://nas.lan:8096', envUrl: null });
    } catch (e) {
      caught = e;
    }
    expect((caught as Error).name).toBe('CredentialTransportInsecureError');
    const message = String((caught as Error).message);
    expect(message).toContain('http://nas.lan:8096'); // actionable: WHICH base was refused
    expect(message).toContain('https://'); // actionable: what the fix is
    expect(message).toContain('VITE_PHLIX_DEV_ALLOW_INSECURE'); // the documented dev escape
  });

  it('passes an https:// persisted base verbatim (the credential-clean config)', () => {
    expect(resolveCredentialBase({ serverUrl: 'https://tv.example:8096 ', envUrl: null })).toBe(
      'https://tv.example:8096',
    );
  });

  it('sanitizes the legacy-poisoned class on read before the scheme gate (M-TIZEN-07 edge reused)', () => {
    // javascript: is POISON, not merely plaintext: it falls to envUrl exactly
    // as resolveAppConfig treats it — the boundary never “refuses” what it
    // first sanitizes away.
    expect(resolveCredentialBase({ serverUrl: 'javascript:alert(1)', envUrl: 'https://env.example' })).toBe(
      'https://env.example',
    );
    expect(resolveCredentialBase({ serverUrl: 'data:text/html,evil', envUrl: null })).toBe('');
  });

  it('the build-time env http:// literal is refused too — env URLs earn no plaintext credential pass', () => {
    expect(() => resolveCredentialBase({ serverUrl: null, envUrl: 'http://ci.example' })).toThrow(
      CredentialTransportInsecureError,
    );
  });

  it('the caller-threaded dev hatch keeps the plaintext base verbatim (disclosure stays at the dial)', () => {
    // Mirrors the shipped hatches: the gate relaxes ONLY for the consumer
    // that owns its per-attempt INSECURE DEV HATCH warning (relay / :8097).
    expect(
      resolveCredentialBase({ serverUrl: 'http://dev.lan:8096', envUrl: null }, true),
    ).toBe('http://dev.lan:8096');
  });

  it('blank, absent, and non-absolute bases keep their existing pass-through semantics', () => {
    expect(resolveCredentialBase({ serverUrl: null, envUrl: null })).toBe('');
    expect(resolveCredentialBase({ serverUrl: '   ', envUrl: null })).toBe('');
    // Non-absolute text cannot carry an http:// credential origin; the
    // builders' own parse-bail (→ '' / invalid-URL refusal) still governs.
    expect(resolveCredentialBase({ serverUrl: 'lan.local', envUrl: null })).toBe('lan.local');
    expect(resolveCredentialBase({ serverUrl: '/relative/base', envUrl: null })).toBe('/relative/base');
    // And the WHATWG parser's dot-scheme class ('lan.local:' IS a scheme) is
    // M-TIZEN-07 POISON, not a pass-through: it sanitizes to the fallback.
    expect(resolveCredentialBase({ serverUrl: 'lan.local:8096', envUrl: null })).toBe('');
    expect(isPlaintextCredentialBase('lan.local:8096')).toBe(false);
  });

  it('ONE planted value, BOTH credential builders refused — the boundary and the dials agree', () => {
    // Reviewer ask: cover both URL builders. The :8097 wsUrl path and the
    // :8804 hub-relay path each keep their own named dial-side refusal (r1 /
    // M-TIZEN-06, law-pinned unmodified); the r2 boundary refuses the SAME
    // value before any consumer config exists. One law, three edges.
    const planted = 'http://nas.lan:8096';
    expect(() => resolveCredentialBase({ serverUrl: planted, envUrl: null })).toThrow(
      CredentialTransportInsecureError,
    );
    expect(() => buildWsUrl(planted, 'room-1', false)).toThrow(SyncPlayInsecureTransportError);
    expect(() => buildHubRelayUrl(planted, 'srv-abc', false)).toThrow(HubRelayInsecureTransportError);
    // …and all three agree the https sibling is fine.
    expect(resolveCredentialBase({ serverUrl: 'https://nas.lan:8096', envUrl: null })).toBe(
      'https://nas.lan:8096',
    );
    expect(buildWsUrl('https://nas.lan:8096', 'room-1', false)).toBe('wss://nas.lan:8097?room=room-1');
    expect(buildHubRelayUrl('https://nas.lan:8096', 'srv-abc', false)).toBe(
      'wss://nas.lan:8804/syncplay/srv-abc',
    );
  });

  it('isPlaintextCredentialBase is the one scheme predicate (matrix)', () => {
    expect(isPlaintextCredentialBase('http://x')).toBe(true);
    expect(isPlaintextCredentialBase('  http://x  ')).toBe(true); // WHATWG trims
    expect(isPlaintextCredentialBase('HTTP://X')).toBe(true); // parser lowercases the scheme
    expect(isPlaintextCredentialBase('https://x')).toBe(false);
    expect(isPlaintextCredentialBase('ws://x')).toBe(false); // not http:; the builder's own guard refuses
    expect(isPlaintextCredentialBase('javascript:alert(1)')).toBe(false); // poison, not plaintext-http
    expect(isPlaintextCredentialBase('lan:8096')).toBe(false); // parses as the unknown scheme `lan:` — not http:
    expect(isPlaintextCredentialBase('')).toBe(false);
    expect(isPlaintextCredentialBase('   ')).toBe(false);
  });
});
