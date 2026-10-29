/**
 * Review tizen__casualgamer M2 — connect-scan assembly unit pins.
 *
 * The M2 defect was a WORKING scanner + suggester sitting dead: no host
 * produced rows for @phlix/ui's `connectScan` seam. These pins hold the cure's
 * behavior contract end-to-end through `createConnectScan`: known addresses
 * always surface (pick-from-list, typing = fallback), bounded user-initiated
 * sweeps add ONLY probed-confirmed rows, confirmed leads unconfirmed, server-
 * sent version data is the only label, and a throwing storage rejects loudly
 * (the page's documented failure note beats a fake empty list). Pure over
 * injected storage + fetch — zero `tizen.*`, zero real network (S503 mask).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assembleConnectCandidates,
  createConnectScan,
} from '@/discovery/connectScan';
import type { HealthProbeResult } from '@/discovery/lanDiscovery';
import { SERVER_HISTORY_KEY } from '@/resolveConfig';

// ── fixtures ────────────────────────────────────────────────────────────────

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

/** A fetch stand-in answering `{base}/health` from a URL → body/throw table. */
function fetchTable(table: Record<string, unknown | 'network-error'>) {
  const calls: string[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const entry = table[url];
    if (entry === 'network-error') throw new TypeError('opaque CORS/network failure');
    if (entry === undefined) return { ok: false, status: 404, json: async () => ({}) } as Response;
    return { ok: true, status: 200, json: async () => entry } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function result(base: string, extra: Partial<HealthProbeResult> = {}): HealthProbeResult {
  return { base, url: `${base}/health`, ok: false, error: 'network', ...extra };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── assembleConnectCandidates (pure) ────────────────────────────────────────

describe('assembleConnectCandidates — honest row assembly', () => {
  it('confirmed rows LEAD unconfirmed history rows', () => {
    const history = ['http://192.168.1.10:8097', 'http://192.168.1.55:8097'];
    const rows = assembleConnectCandidates(history, [
      result('http://192.168.1.10:8097'), // known, not confirmed → second tier
      result('http://192.168.1.55:8097', { ok: true, version: '1.2.3' }), // confirmed → first
    ]);
    expect(rows).toEqual([
      { url: 'http://192.168.1.55:8097', label: 'v1.2.3' },
      { url: 'http://192.168.1.10:8097' },
    ]);
  });

  it('an unconfirmed subnet GUESS never shows — no fabricated IPs', () => {
    const rows = assembleConnectCandidates(
      ['http://192.168.1.10:8097'],
      [
        result('http://192.168.1.10:8097', { ok: true }),
        result('http://192.168.1.7:8097'), // sweep guess, opaque/CORS/absent → dropped
      ],
    );
    expect(rows).toEqual([{ url: 'http://192.168.1.10:8097' }]);
  });

  it('labels carry ONLY server-sent version data (no UI strings to localize)', () => {
    const rows = assembleConnectCandidates(
      [],
      [
        result('http://a:8097', { ok: true, version: '0.9.2' }),
        result('http://b:8097', { ok: true }), // version absent → no label key at all
      ],
    );
    expect(rows).toEqual([{ url: 'http://a:8097', label: 'v0.9.2' }, { url: 'http://b:8097' }]);
    expect(rows[1]).not.toHaveProperty('label');
  });

  it('host-key dedup keeps one row per machine across spellings', () => {
    const rows = assembleConnectCandidates(
      ['http://h:8096'],
      [result('http://h:8096', { ok: true, version: '1.0' })],
    );
    expect(rows).toHaveLength(1);
  });
});

// ── createConnectScan (composed over injected deps) ─────────────────────────

describe('createConnectScan — the M2 cure end-to-end at the host seam', () => {
  it('FIRST-RUN PICK-FROM-LIST: history rows surface even when EVERY probe fails', () => {
    // The exact M2 scenario: CORS-opaque / sleeping hosts must NOT blind the
    // suggester — these are addresses the TV itself connected to before.
    const store = memStore({
      [SERVER_HISTORY_KEY]: JSON.stringify(['http://192.168.1.40:8097', 'http://192.168.1.9:8097']),
    });
    const { impl } = fetchTable({}); // nothing answers
    const scan = createConnectScan({ storage: store, currentBase: () => null, fetchImpl: impl });
    return expect(scan()).resolves.toEqual([
      { url: 'http://192.168.1.40:8097' },
      { url: 'http://192.168.1.9:8097' },
    ]);
  });

  it('a confirmed sweep sibling is ADDED with its version label; a silent one is not', async () => {
    const store = memStore({ [SERVER_HISTORY_KEY]: JSON.stringify(['http://192.168.1.40:8097']) });
    const { impl } = fetchTable({
      'http://192.168.1.40:8097/health': 'network-error',
      'http://192.168.1.5:8097/health': { status: 'ok', version: '2.1.0' }, // the gateway box
    });
    const scan = createConnectScan({
      storage: store,
      currentBase: () => 'http://192.168.1.40:8097',
      fetchImpl: impl,
    });
    const rows = await scan();
    expect(rows).toEqual([
      { url: 'http://192.168.1.5:8097', label: 'v2.1.0' }, // confirmed leads
      { url: 'http://192.168.1.40:8097' }, // known, unconfirmed, still offered
    ]);
  });

  it('the sweep anchors on the CURRENT base, falling back to most-recent history', async () => {
    const { impl, calls } = fetchTable({});
    const store = memStore({ [SERVER_HISTORY_KEY]: JSON.stringify(['http://192.168.1.40:8097']) });
    await createConnectScan({ storage: store, currentBase: () => 'http://192.168.1.77:8097', fetchImpl: impl, sweepLimit: 2 })();
    expect(calls).toContain('http://192.168.1.1:8097/health'); // anchored at .77's subnet .1 first
    expect(calls).not.toContain('http://192.168.1.39:8097/health'); // NOT anchored at history[0]

    const second = fetchTable({});
    await createConnectScan({ storage: store, currentBase: () => null, fetchImpl: second.impl, sweepLimit: 2 })();
    expect(second.calls).toContain('http://192.168.1.2:8097/health'); // anchored at history[0]
  });

  it('the persisted base is a KNOWN row even with no history (pre-history installs)', async () => {
    // The reconnect scenario: an install older than the history feature has a
    // serverUrl and NO phlix.serverHistory — the base must still be offered.
    const { impl } = fetchTable({});
    const rows = await createConnectScan({
      storage: memStore(),
      currentBase: () => 'http://192.168.1.99:8097',
      fetchImpl: impl,
    })();
    expect(rows).toEqual([{ url: 'http://192.168.1.99:8097' }]);
  });

  it('a NOTHING-known first launch scans to an honest [] with ZERO probes', async () => {
    const { impl, calls } = fetchTable({});
    const rows = await createConnectScan({ storage: memStore(), currentBase: () => null, fetchImpl: impl })();
    expect(rows).toEqual([]);
    expect(calls).toEqual([]); // never spray from the living room
  });

  it('a non-private base produces NO sibling sweep — only the known address is probed', async () => {
    const { impl, calls } = fetchTable({});
    const rows = await createConnectScan({
      storage: memStore(),
      currentBase: () => 'https://tv.example.com',
      fetchImpl: impl,
    })();
    expect(calls).toEqual(['https://tv.example.com/health']); // the base itself, nothing else
    expect(rows).toEqual([{ url: 'https://tv.example.com' }]); // offered as known even unconfirmed
  });

  it('sweeps are BOUNDED: history ≤ 6 + the 16-sibling budget, deduped, no storms', async () => {
    const many = Array.from({ length: 10 }, (_, i) => `http://10.0.0.${20 + i}:8097`);
    const store = memStore({ [SERVER_HISTORY_KEY]: JSON.stringify(many) });
    const { impl, calls } = fetchTable({});
    await createConnectScan({ storage: store, currentBase: () => null, fetchImpl: impl })();
    // history caps at 6 distinct hosts; the .20 anchor's sibling spread runs
    // .1-.16 (16 guesses — the anchor itself sits outside that first octet run).
    expect(calls.length).toBe(6 + 16);
  });

  it('FAIL LOUD: a throwing storage rejects — the page renders its honest failure note', async () => {
    const store = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
    };
    const scan = createConnectScan({ storage: store, currentBase: () => null, fetchImpl: fetchTable({}).impl });
    await expect(scan()).rejects.toThrow('SecurityError');
  });

  it('PRIVILEGE GREP: the module touches no tizen/systeminfo/webapis API', () => {
    const source = readFileSync(resolve(__dirname, '../../src/discovery/connectScan.ts'), 'utf8');
    for (const banned of ['tizen.', 'systeminfo', 'webapis', 'window.', 'document.']) {
      expect(source).not.toContain(banned);
    }
  });
});
