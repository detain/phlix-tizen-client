/**
 * S515 AD-3 — bootProbe unit pins.
 *
 * These run against the REAL `@phlix/ui` `probeServer` (no module mocks) with
 * an injected fake fetch, so the wrapper is pinned end-to-end against the
 * probe semantics that actually ship: loose `/health` body acceptance,
 * non-OK/CORS/malformed → unreachable, and the 6 s abort budget. The empty
 * base must skip the probe entirely (the ui connect-gate owns that path).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { probeBootBase } from '@/bootProbe';

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('probeBootBase (S515 AD-3)', () => {
  it('returns "empty" for an empty base WITHOUT touching the network', async () => {
    const fetchSpy = vi.fn();
    await expect(probeBootBase('', fetchSpy as unknown as typeof fetch)).resolves.toBe('empty');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns "reachable" when /health answers the live server tuple {status:"ok",timestamp,version}', async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({ status: 'ok', timestamp: 1757000000, version: '1.2.3' })
    );
    await expect(
      probeBootBase('http://my-tv-server:8096', fetchSpy as unknown as typeof fetch)
    ).resolves.toBe('reachable');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://my-tv-server:8096/health');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns "reachable" on the loose shape alone ({version} only) — no hard server contract assert', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ version: '9.9.9' }));
    await expect(
      probeBootBase('http://host:8096', fetchSpy as unknown as typeof fetch)
    ).resolves.toBe('reachable');
  });

  it('returns "unreachable" on a non-OK response', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ status: 'ok' }, false));
    await expect(
      probeBootBase('http://host:8096', fetchSpy as unknown as typeof fetch)
    ).resolves.toBe('unreachable');
  });

  it('returns "unreachable" when fetch rejects — the CORS-restricted / network-error class', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(
      probeBootBase('http://cors-blocked:8096', fetchSpy as unknown as typeof fetch)
    ).resolves.toBe('unreachable');
  });

  it('returns "unreachable" when the body is not JSON', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('not json');
      },
    }) as unknown as Response);
    await expect(
      probeBootBase('http://html:8096', fetchSpy as unknown as typeof fetch)
    ).resolves.toBe('unreachable');
  });

  it('aborts a hanging probe at the 6 s budget — unreachable, never a hung boot', async () => {
    vi.useFakeTimers();
    const fetchSpy = (
      _input: unknown,
      init?: { signal?: AbortSignal }
    ) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        );
      });
    let settled: string | null = null;
    const probe = probeBootBase('http://silent:8096', fetchSpy as unknown as typeof fetch).then(
      (verdict) => {
        settled = verdict;
        return verdict;
      }
    );

    await vi.advanceTimersByTimeAsync(5999);
    expect(settled).toBeNull(); // still probing just under the budget

    await vi.advanceTimersByTimeAsync(1);
    await expect(probe).resolves.toBe('unreachable');
  });
});
