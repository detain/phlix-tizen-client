/**
 * S529 AD-24 — mDNS-less LAN discovery unit pins.
 *
 * Everything here runs against injected fetch fakes in jsdom: the engine must
 * touch neither `tizen.*` nor `window` at import (privilege-honest per the S503
 * mask — the whole point is that LAN discovery rides ONLY the granted `internet`
 * fetch, never `tizen.systeminfo`/`webapis`). The AC-2 shape under test:
 * found / not-found / timeout, the AbortController deadline honored, bounded
 * concurrency, dedup by host, and the loose `/health` body rule (status==='ok'
 * OR version present — never a hard server-contract assert).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  normalizeBase,
  healthUrl,
  isPhlixHealth,
  hostKey,
  prepareCandidates,
  chunk,
  probeHealth,
  discoverServers,
  sameSubnetCandidates,
  buildCandidatesFromHistory,
  DEFAULT_HEALTH_TIMEOUT_MS,
  DEFAULT_CONCURRENCY,
} from '@/discovery/lanDiscovery';

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('normalizeBase / healthUrl', () => {
  it('trims whitespace and trailing slashes so spellings collapse', () => {
    expect(normalizeBase('  http://host:8096/  ')).toBe('http://host:8096');
    expect(normalizeBase('http://host:8096///')).toBe('http://host:8096');
  });

  it('builds the root health URL, and returns "" for an empty base', () => {
    expect(healthUrl('http://host:8096/')).toBe('http://host:8096/health');
    expect(healthUrl('')).toBe('');
  });
});

describe('isPhlixHealth (loose body rule)', () => {
  it('accepts {status:"ok"} OR a bare {version} — no hard contract assert', () => {
    expect(isPhlixHealth({ status: 'ok', timestamp: 1, version: '1.2.3' })).toBe(true);
    expect(isPhlixHealth({ version: '9.9.9' })).toBe(true);
    expect(isPhlixHealth({ status: 'ok' })).toBe(true);
  });
  it('rejects null, non-objects and unrecognised bodies', () => {
    expect(isPhlixHealth(null)).toBe(false);
    expect(isPhlixHealth('nope')).toBe(false);
    expect(isPhlixHealth({ service: 'nginx' })).toBe(false);
  });
});

describe('hostKey / prepareCandidates (dedup + cap)', () => {
  it('dedupes by host+port so two spellings of one machine probe once', () => {
    const out = prepareCandidates(['http://h:8096/', 'http://h:8096', 'http://g:8096']);
    expect(out).toEqual(['http://h:8096', 'http://g:8096']);
  });
  it('drops empties and caps the sweep', () => {
    const many = Array.from({ length: 40 }, (_, i) => `http://h${i}:8096`);
    expect(prepareCandidates(many, 5)).toHaveLength(5);
    expect(prepareCandidates(['', '  ', 'http://x'])).toEqual(['http://x']);
  });
  it('hostKey lowercases and falls back for non-URL strings', () => {
    expect(hostKey('http://HOST:8096/')).toBe('host:8096');
    expect(hostKey('')).toBe('');
  });
});

describe('chunk', () => {
  it('splits into bounded consecutive groups', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe('probeHealth (per-host verdict)', () => {
  it('empty base never touches the network', async () => {
    const spy = vi.fn();
    const res = await probeHealth('', { fetchImpl: spy as unknown as typeof fetch });
    expect(res).toEqual({ base: '', url: '', ok: false, error: 'empty' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('found: GET {base}/health with an AbortSignal, loose body accepted', async () => {
    const spy = vi.fn(async () => jsonResponse({ status: 'ok', version: '1.2.3' }));
    const res = await probeHealth('http://h:8096/', { fetchImpl: spy as unknown as typeof fetch });
    expect(res.ok).toBe(true);
    expect(res.base).toBe('http://h:8096');
    expect(res.version).toBe('1.2.3');
    expect(res.status).toBe('ok');
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://h:8096/health');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('http: a non-OK response is not a phlix server', async () => {
    const spy = vi.fn(async () => jsonResponse({ status: 'ok' }, false));
    const res = await probeHealth('http://h:8096', { fetchImpl: spy as unknown as typeof fetch });
    expect(res).toMatchObject({ ok: false, error: 'http' });
  });

  it('shape: a 200 that is not phlix health (foreign service banner)', async () => {
    const spy = vi.fn(async () => jsonResponse({ server: 'nginx' }));
    const res = await probeHealth('http://h:8096', { fetchImpl: spy as unknown as typeof fetch });
    expect(res).toMatchObject({ ok: false, error: 'shape' });
  });

  it('network: a rejected fetch (CORS-opaque host / down) classifies as network', async () => {
    const spy = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const res = await probeHealth('http://h:8096', { fetchImpl: spy as unknown as typeof fetch });
    expect(res).toMatchObject({ ok: false, error: 'network' });
  });

  it('timeout: the AbortController deadline fires and the hang resolves as timeout', async () => {
    vi.useFakeTimers();
    // A fetch that never settles until its signal aborts — models a silent host.
    const hang: typeof fetch = (_url, init) =>
      new Promise((_res, rej) => {
        const signal = (init as RequestInit).signal;
        signal?.addEventListener('abort', () => rej(new Error('aborted')));
      });
    const p = probeHealth('http://h:8096', { fetchImpl: hang, timeoutMs: 400 });
    await vi.advanceTimersByTimeAsync(DEFAULT_HEALTH_TIMEOUT_MS);
    const res = await p;
    expect(res).toMatchObject({ ok: false, error: 'timeout' });
  });
});

describe('discoverServers (bounded sweep)', () => {
  it('probes every candidate, fires onServerFound per hit and onProgress per settle', async () => {
    const spy = vi.fn(async (url: string) =>
      url.includes('live') ? jsonResponse({ status: 'ok', version: '1.0' }) : jsonResponse({ no: 'health' })
    );
    const found: string[] = [];
    const progress: Array<[number, number]> = [];
    const results = await discoverServers(
      ['http://live1:8096', 'http://dead:8096', 'http://live2:8096'],
      {
        fetchImpl: spy as unknown as typeof fetch,
        concurrency: DEFAULT_CONCURRENCY,
        onServerFound: (r) => found.push(r.base),
        onProgress: (done, total) => progress.push([done, total]),
      }
    );
    expect(results).toHaveLength(3);
    expect(found.sort()).toEqual(['http://live1:8096', 'http://live2:8096']);
    expect(progress).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('bounds peak in-flight to the requested concurrency', async () => {
    let inFlight = 0;
    let peak = 0;
    const spy = vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return jsonResponse({ status: 'ok' });
    });
    const candidates = Array.from({ length: 6 }, (_, i) => `http://h${i}:8096`);
    await discoverServers(candidates, { fetchImpl: spy as unknown as typeof fetch, concurrency: 2 });
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('dedupes host spellings so a machine is never probed twice', async () => {
    const spy = vi.fn(async () => jsonResponse({ status: 'ok' }));
    const results = await discoverServers(
      ['http://h:8096', 'http://h:8096/', 'http://h:8096//'],
      { fetchImpl: spy as unknown as typeof fetch }
    );
    expect(results).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('sameSubnetCandidates (explicit-scan helper, never auto-run)', () => {
  it('yields bounded private-v4 siblings, skipping the base itself', () => {
    const out = sameSubnetCandidates('http://192.168.1.50:8096', 4);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((c) => c.startsWith('http://192.168.1.') && c.endsWith(':8096'))).toBe(true);
    expect(out).not.toContain('http://192.168.1.50:8096');
  });
  it('returns [] for public / non-http hosts (no blind external spray)', () => {
    expect(sameSubnetCandidates('https://example.com')).toEqual([]);
    expect(sameSubnetCandidates('http://8.8.8.8:8096')).toEqual([]);
    expect(sameSubnetCandidates('')).toEqual([]);
  });
});

describe('buildCandidatesFromHistory', () => {
  it('is the deduped, capped default source for first-run suggestions', () => {
    const out = buildCandidatesFromHistory(['http://a', 'http://a/', 'http://b', ''], 2);
    expect(out).toEqual(['http://a', 'http://b']);
  });
});
