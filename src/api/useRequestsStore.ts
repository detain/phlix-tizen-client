/**
 * Ref-counted request-dedup store (S530 — AD-15).
 *
 * One in-flight call per `JSON.stringify(args)` key. Concurrent identical
 * requests COALESCE onto a single underlying fetch whose result fans out to
 * every subscriber; when the last subscriber leaves the entry auto-evicts (so a
 * later, non-overlapping request re-fetches honestly), unless the key was
 * flagged `persistent`. `refresh()` re-runs the key's fetcher but COALESCES
 * repeated triggers fired inside a `refreshIn(ms)` window into one refetch, and
 * an initialization gate (`isReady`) lets boot code refuse to act on a null that
 * merely means "the first reply has not landed yet" instead of "it resolved
 * empty".
 *
 * ## TN-8 hard law — reuse the T-07 generation idiom, add no second mechanism
 *
 * Superseded replies are dropped with the EXACT `++gen` / `gen !== cur` pattern
 * proven live in `ChapterOverlay.vue` / `SkipIntroOverlay.vue` (S501 T-07): every
 * fetch mints `const gen = ++entry.gen`, and only a reply whose `gen` is still
 * `entry.gen` at settle-time is published. Coalescing SUBSUMES late-arrival
 * dropping (joiners share one promise), so the generation guard is the only place
 * a result can be discarded — there is deliberately NO AbortController race, no
 * second `version`/`epoch` counter, no mutex. `tests/unit/useRequestsStore.test.ts`
 * greps this file to keep that guarantee from silently eroding.
 *
 * This is request DEDUP / COALESCING, not a cache (S519 no-second-cache precedent
 * holds): nothing here keeps a value after its last subscriber departs, and it is
 * the request layer only — `@phlix/ui`'s `useMediaItemCache` SWR single-item cache
 * is deliberately NOT forked here. Era law: no new routes / contracts / server
 * change — the store is transport-agnostic over an injected `fetcher` and never
 * touches the wire or a URL literal itself.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

/** A zero-arg thunk that performs the underlying (async) work for a key. */
export type Fetcher<T> = () => Promise<T>;

export interface RequestOptions {
  /** Keep the entry after its last subscriber leaves (never auto-evict). */
  readonly persistent?: boolean;
  /** Coalescing window in ms for `refresh()`; repeated triggers inside it collapse to one. */
  readonly refreshIn?: number;
}

/** Options with defaults resolved — the shape an entry actually carries. */
interface ResolvedOptions {
  persistent: boolean;
  refreshIn: number;
}

interface Entry {
  readonly key: string;
  readonly subscribers: Set<symbol>;
  options: ResolvedOptions;
  /** Latest fetcher, so `refresh()` can re-run the key without the caller re-supplying it. */
  fetcher: Fetcher<unknown> | null;
  /** T-07 generation counter — bumped on every fetch; stale replies are the ones that miss the current value. */
  gen: number;
  /** The single shared in-flight promise for the current generation, or null when idle. */
  inFlight: Promise<unknown> | null;
  /** True once a current-generation reply has landed (the init gate). */
  ready: boolean;
  /** Pending coalesced-refresh timer, if one is armed. */
  refreshTimer: ReturnType<typeof setTimeout> | null;
}

/** Resolve request options to the entry's internal shape (defaults: transient, immediate). */
function resolveOptions(opts: RequestOptions | undefined): ResolvedOptions {
  return {
    persistent: opts?.persistent === true,
    refreshIn: typeof opts?.refreshIn === 'number' && opts.refreshIn > 0 ? opts.refreshIn : 0,
  };
}

/**
 * Parse the dedup key at the boundary. A non-serialisable `args` (a function, a
 * BigInt, a circular structure) throws HERE, loudly, before any fetch starts —
 * the caller gets a clear error instead of a silently-unshared request (Law 4).
 */
function keyOf(args: unknown): string {
  return JSON.stringify(args);
}

/**
 * The ref-counted request-dedup store. Returned by both the module singleton
 * (`useRequestsStore`, what production consumers share) and the factory
 * (`createRequestsStore`, what the suite injects for total isolation).
 */
export interface RequestsStore {
  /**
   * Join-or-start the in-flight call for `args`. Concurrent identical calls
   * resolve from ONE underlying `fetcher` invocation; every caller is a transient
   * subscriber for the life of the await.
   */
  request<T>(args: unknown, fetcher: Fetcher<T>, opts?: RequestOptions): Promise<T>;
  /**
   * Register a long-lived subscriber that receives EVERY published result for
   * `args` (initial fetch included). Returns an unsubscribe fn that releases the
   * reference; the entry evicts once the last subscriber leaves (unless persistent).
   */
  subscribe<T>(args: unknown, fetcher: Fetcher<T>, onResult: (value: T) => void, opts?: RequestOptions): () => void;
  /**
   * Re-run `args`' fetcher. Calls inside a `refreshIn(ms)` window COALESCE into a
   * single refetch. A superseded reply is dropped via the T-07 generation guard.
   */
  refresh<T>(args: unknown, fetcher: Fetcher<T>, opts?: RequestOptions): void;
  /** Init gate — TRUE only once a current-generation reply has actually landed. */
  isReady(args: unknown): boolean;
  /** Number of live subscribers for `args` (introspection seam for the suite). */
  subscriberCount(args: unknown): number;
  /** Drop every entry and cancel every pending refresh timer. */
  clear(): void;
}

/**
 * Build an isolated store. Pure over its own closure — no ambient globals except
 * `setTimeout`/`clearTimeout` (which the suite fakes).
 */
export function createRequestsStore(): RequestsStore {
  const entries = new Map<string, Entry>();
  // Per-symbol fan-out sink, kept beside (not inside) the subscriber SET so the set
  // stays a plain ref-count and a one-shot `request` needs no listener of its own.
  const listeners = new Map<symbol, (value: unknown) => void>();

  function getOrCreate(args: unknown, opts: RequestOptions | undefined): Entry {
    const key = keyOf(args);
    const existing = entries.get(key);
    if (existing) {
      existing.options = resolveOptions(opts);
      return existing;
    }
    const entry: Entry = {
      key,
      subscribers: new Set(),
      options: resolveOptions(opts),
      fetcher: null,
      gen: 0,
      inFlight: null,
      ready: false,
      refreshTimer: null,
    };
    entries.set(key, entry);
    return entry;
  }

  /** Fan a settled current-generation value out to every live `subscribe` sink. */
  function fanOut(entry: Entry, value: unknown): void {
    for (const sub of entry.subscribers) {
      const listener = listeners.get(sub);
      if (listener) listener(value);
    }
  }

  /** Release one reference; evict the entry once nothing holds it and none is pending. */
  function release(entry: Entry, sub: symbol): void {
    entry.subscribers.delete(sub);
    listeners.delete(sub);
    if (entry.subscribers.size > 0) return;
    if (entry.options.persistent) return;
    if (entry.inFlight) return;
    if (entry.refreshTimer) return;
    if (entries.get(entry.key) === entry) entries.delete(entry.key);
  }

  /** Start a new generation for `entry` and run its fetcher. */
  function run(entry: Entry): Promise<unknown> {
    const fetcher = entry.fetcher;
    if (!fetcher) return Promise.reject(new Error('requests store: run() called with no fetcher'));
    const gen = ++entry.gen; // T-07: mint a new generation for this attempt.
    const promise = fetcher().then(
      (value) => {
        if (gen !== entry.gen) return value; // superseded by a newer generation — do not publish
        entry.ready = true;
        entry.inFlight = null;
        fanOut(entry, value);
        return value;
      },
      (error: unknown) => {
        if (gen !== entry.gen) throw error; // superseded — swallow into the newer attempt
        entry.inFlight = null;
        throw error;
      },
    );
    entry.inFlight = promise;
    return promise;
  }

  function request<T>(args: unknown, fetcher: Fetcher<T>, opts?: RequestOptions): Promise<T> {
    const entry = getOrCreate(args, opts);
    entry.fetcher = fetcher as Fetcher<unknown>;
    const sub = Symbol(entry.key);
    entry.subscribers.add(sub);

    const shared = entry.inFlight ?? run(entry);
    return shared.then(
      (value) => {
        release(entry, sub);
        return value as T;
      },
      (error: unknown) => {
        release(entry, sub);
        throw error;
      },
    );
  }

  function subscribe<T>(
    args: unknown,
    fetcher: Fetcher<T>,
    onResult: (value: T) => void,
    opts?: RequestOptions,
  ): () => void {
    const entry = getOrCreate(args, opts);
    entry.fetcher = fetcher as Fetcher<unknown>;
    const sub = Symbol(entry.key);
    listeners.set(sub, onResult as (value: unknown) => void);
    entry.subscribers.add(sub);

    if (!entry.inFlight) void run(entry).catch(() => undefined);

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      release(entry, sub);
    };
  }

  function refresh<T>(args: unknown, fetcher: Fetcher<T>, opts?: RequestOptions): void {
    const entry = getOrCreate(args, opts);
    entry.fetcher = fetcher as Fetcher<unknown>;

    const window = entry.options.refreshIn;
    if (window <= 0) {
      void run(entry).catch(() => undefined);
      return;
    }
    // Coalesce: a refresh already scheduled inside the window wins — do not arm a second.
    if (entry.refreshTimer) return;
    entry.refreshTimer = setTimeout(() => {
      entry.refreshTimer = null;
      void run(entry).catch(() => undefined);
    }, window);
  }

  function isReady(args: unknown): boolean {
    return entries.get(keyOf(args))?.ready === true;
  }

  function subscriberCount(args: unknown): number {
    return entries.get(keyOf(args))?.subscribers.size ?? 0;
  }

  function clear(): void {
    for (const entry of entries.values()) {
      if (entry.refreshTimer) clearTimeout(entry.refreshTimer);
    }
    entries.clear();
    listeners.clear();
  }

  return { request, subscribe, refresh, isReady, subscriberCount, clear };
}

/**
 * The shared production instance. Every consumer that calls `useRequestsStore()`
 * gets the SAME dedup map, so a double-ENTER from one surface and a re-drill from
 * another coalesce together — which is the point of a request store.
 */
let singleton: RequestsStore | null = null;

export function useRequestsStore(): RequestsStore {
  if (!singleton) singleton = createRequestsStore();
  return singleton;
}
