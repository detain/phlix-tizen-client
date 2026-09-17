/**
 * useRequestsStore — ref-counted request dedup (S530, AD-15).
 *
 * The whole point of this suite is the concurrency behaviour, so it drives the
 * store against INJECTED fetch fakes (never a real wire) built on manually
 * resolvable deferreds — that is what makes "N concurrent = ONE call" and
 * "stale reply dropped" observable and deterministic rather than timing-luck.
 *
 * AC#1 is the load-bearing one: the reused T-07 `++gen` / `gen !== cur` idiom is
 * the ONLY race-defense mechanism. The last group greps the module SOURCE to keep
 * a second mechanism (an AbortController race, a parallel version/epoch counter, a
 * lock) from being introduced later without failing here.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequestsStore, useRequestsStore } from '@/api/useRequestsStore';
import type { RequestsStore } from '@/api/useRequestsStore';

const ALBUM = { kind: 'music.album', title: 'A1', artist: 'X' };
const OTHER = { kind: 'music.album', title: 'A2', artist: 'X' };

/** A fetch whose resolution the test controls, plus how many times it was invoked. */
function deferred() {
  let resolve!: (v: unknown) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A counting fetch fake that returns the next deferred's promise per call. */
function countingFetcher(results: unknown[]) {
  const calls: number[] = [];
  let n = 0;
  const fetcher = vi.fn(async () => {
    calls.push(n);
    const value = results[Math.min(n, results.length - 1)];
    n += 1;
    return value;
  });
  return { fetcher, calls, get count() { return fetcher.mock.calls.length; } };
}

describe('useRequestsStore — coalescing (AC#1)', () => {
  let store: RequestsStore;
  beforeEach(() => {
    store = createRequestsStore();
  });

  it('collapses concurrent identical requests to ONE underlying call, fanning the result out', async () => {
    const d = deferred();
    const fetcher = vi.fn(() => d.promise);

    const a = store.request(ALBUM, fetcher);
    const b = store.request(ALBUM, fetcher);
    const c = store.request(ALBUM, fetcher);
    d.resolve('ALBUM-PAYLOAD');

    const [ra, rb, rc] = await Promise.all([a, b, c]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect([ra, rb, rc]).toEqual(['ALBUM-PAYLOAD', 'ALBUM-PAYLOAD', 'ALBUM-PAYLOAD']);
  });

  it('does NOT coalesce across DIFFERENT keys', async () => {
    const { fetcher } = countingFetcher(['V1', 'V2']);
    await Promise.all([store.request(ALBUM, fetcher as () => Promise<unknown>), store.request(OTHER, fetcher as () => Promise<unknown>)]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('re-fetches once the in-flight call has fully settled (dedup is concurrency-scoped, not a cache)', async () => {
    const { fetcher } = countingFetcher(['FIRST', 'SECOND']);
    const first = await store.request(ALBUM, fetcher as () => Promise<unknown>);
    const second = await store.request(ALBUM, fetcher as () => Promise<unknown>);
    expect([first, second]).toEqual(['FIRST', 'SECOND']);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('a rejected shared call surfaces the same error to every joiner, then evicts', async () => {
    const boom = new Error('network down');
    const fetcher = vi.fn(() => Promise.reject(boom));
    const a = store.request(ALBUM, fetcher);
    const b = store.request(ALBUM, fetcher);
    await expect(a).rejects.toBe(boom);
    await expect(b).rejects.toBe(boom);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(store.isReady(ALBUM)).toBe(false);
  });
});

describe('useRequestsStore — reference counting & eviction (AC#1)', () => {
  let store: RequestsStore;
  beforeEach(() => {
    store = createRequestsStore();
  });

  it('evicts a transient key once its last subscriber leaves', async () => {
    const seen: unknown[] = [];
    const unsub = store.subscribe(ALBUM, async () => 'V', (v) => seen.push(v));
    await vi.waitFor(() => expect(seen).toEqual(['V']));
    expect(store.subscriberCount(ALBUM)).toBe(1);
    expect(store.isReady(ALBUM)).toBe(true);

    unsub();
    expect(store.subscriberCount(ALBUM)).toBe(0);
    // The entry is gone → the init gate reads false again (a non-persistent key does not persist).
    expect(store.isReady(ALBUM)).toBe(false);
  });

  it('keeps a PERSISTENT key after its last subscriber leaves', async () => {
    const seen: unknown[] = [];
    const unsub = store.subscribe(ALBUM, async () => 'V', (v) => seen.push(v), { persistent: true });
    await vi.waitFor(() => expect(seen).toEqual(['V']));

    unsub();
    expect(store.subscriberCount(ALBUM)).toBe(0);
    // Eviction suppressed → the entry (and its landed-result gate) survive.
    expect(store.isReady(ALBUM)).toBe(true);
  });

  it('unsubscribing twice releases only once (idempotent teardown)', async () => {
    const unsub = store.subscribe(ALBUM, async () => 'V', () => undefined);
    await vi.waitFor(() => expect(store.subscriberCount(ALBUM)).toBe(1));
    unsub();
    unsub();
    expect(store.subscriberCount(ALBUM)).toBe(0);
  });

  it('fans ONE in-flight result out to every subscriber', async () => {
    const d = deferred();
    const fetcher = vi.fn(() => d.promise);
    const one: unknown[] = [];
    const two: unknown[] = [];
    store.subscribe(ALBUM, fetcher, (v) => one.push(v));
    store.subscribe(ALBUM, fetcher, (v) => two.push(v));
    d.resolve('SHARED');

    await vi.waitFor(() => expect([one, two]).toEqual([['SHARED'], ['SHARED']]));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('useRequestsStore — refresh coalescing (AC#1)', () => {
  let store: RequestsStore;
  beforeEach(() => {
    store = createRequestsStore();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('collapses rapid refresh triggers inside refreshIn(ms) into a single refetch', async () => {
    const { fetcher } = countingFetcher(['A', 'B', 'C']);
    const key = { kind: 'rec' };

    // `refresh` supplies its own fetcher and adds no subscriber — the entry lives
    // on its pending timer, so the whole burst sees the SAME coalescing window.
    store.refresh(key, fetcher as () => Promise<unknown>, { refreshIn: 200 });
    store.refresh(key, fetcher as () => Promise<unknown>, { refreshIn: 200 });
    store.refresh(key, fetcher as () => Promise<unknown>, { refreshIn: 200 });

    expect(fetcher).toHaveBeenCalledTimes(0); // still inside the window — nothing fired yet
    await vi.advanceTimersByTimeAsync(200);
    expect(fetcher).toHaveBeenCalledTimes(1); // the whole burst collapsed to ONE refetch

    // A refresh AFTER the window is a NEW coalesced group, not the same one.
    store.refresh(key, fetcher as () => Promise<unknown>, { refreshIn: 200 });
    await vi.advanceTimersByTimeAsync(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('a refreshIn window of 0 (or absent) refreshes immediately', async () => {
    const { fetcher } = countingFetcher(['A', 'B']);
    store.refresh(ALBUM, fetcher as () => Promise<unknown>);
    expect(fetcher).toHaveBeenCalledTimes(1); // no window → runs at once

    store.refresh(ALBUM, fetcher as () => Promise<unknown>);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('useRequestsStore — initialization gate (AC#1)', () => {
  let store: RequestsStore;
  beforeEach(() => {
    store = createRequestsStore();
  });

  it('isReady is false before the first reply and true after it lands', async () => {
    const d = deferred();
    const req = store.request(ALBUM, () => d.promise);
    expect(store.isReady(ALBUM)).toBe(false); // boot-race null guard: nothing landed yet

    d.resolve('V');
    await req;
    // After eviction (transient) it returns to false — "ready" tracks a live entry.
    expect(store.isReady(ALBUM)).toBe(false);
  });

  it('a persistent key stays ready across the gap between calls', async () => {
    const first = await store.request(ALBUM, async () => 'V', { persistent: true });
    expect(first).toBe('V');
    expect(store.isReady(ALBUM)).toBe(true);
  });
});

describe('useRequestsStore — T-07 generation reuse, no second race-defense (AC#1 pin)', () => {
  let store: RequestsStore;
  beforeEach(() => {
    store = createRequestsStore();
  });

  it('drops a superseded reply so only the newest generation publishes', async () => {
    const slow = deferred();
    const fast = deferred();
    let call = 0;
    const fetcher = vi.fn(() => (call++ === 0 ? slow.promise : fast.promise));

    const sink: unknown[] = [];
    // persistent keeps the entry alive across the manual refresh below.
    store.subscribe(ALBUM, fetcher, (v) => sink.push(v), { persistent: true });
    expect(fetcher).toHaveBeenCalledTimes(1); // generation 1 (slow) in flight

    store.refresh(ALBUM, fetcher, { persistent: true }); // generation 2 (fast)
    expect(fetcher).toHaveBeenCalledTimes(2);

    fast.resolve('NEW');
    await vi.waitFor(() => expect(sink).toEqual(['NEW']));

    slow.resolve('STALE'); // the superseded generation lands late…
    await Promise.resolve();
    await vi.waitFor(() => expect(sink).toEqual(['NEW'])); // …and is DROPPED, not published
  });

  it('the module reuses the `++gen` / `gen !== cur` idiom and introduces NO second mechanism (source pin)', () => {
    const file = path.resolve(__dirname, '..', '..', 'src', 'api', 'useRequestsStore.ts');
    const code = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '') // strip block comments (the docblock NAMES the idiom)
      .replace(/^\s*\/\/.*$/gm, ''); // strip line comments

    // The reused idiom MUST be present in executable code.
    expect(code).toMatch(/\+\+\s*entry\.gen/);
    expect(code).toMatch(/gen\s*!==\s*entry\.gen/);

    // No second race-defense mechanism may appear (TN-8 hard law).
    expect(code).not.toMatch(/AbortController/);
    expect(code).not.toMatch(/\.\s*abort\s*\(/);
    expect(code).not.toMatch(/\bepoch\b/);
    expect(code).not.toMatch(/\bmutex\b/i);
    expect(code).not.toMatch(/\bcriticalSection\b/i);
    expect(code).not.toMatch(/\bversion\b/);
  });

  it('the shared singleton is the SAME instance every call (one dedup map app-wide)', () => {
    expect(useRequestsStore()).toBe(useRequestsStore());
    expect(useRequestsStore()).not.toBe(createRequestsStore());
  });
});
