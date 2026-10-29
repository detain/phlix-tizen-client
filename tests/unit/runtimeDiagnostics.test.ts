/**
 * tests/unit/runtimeDiagnostics.test.ts — error-visibility brief cure
 * (truth-pass r1: re-badged from a fabricated 'review tizen__devops M3' tag).
 *
 * Pins the on-device failure ring: bounded writes, parse-validated reads,
 * burst suppression, the NEVER-THROW capture posture (hostile storage,
 * hostile event fields), window listener registration/disposal, and the
 * estate honesty laws the way the sibling suites pin theirs: source greps
 * for zero network and zero platform-API reach (no crash uploader, no
 * privilege creep), plus the old-webview API-floor greps of this module.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  DIAGNOSTICS_KEY,
  MAX_RECORDED_FAILURES,
  FAILURE_MESSAGE_LIMIT,
  DUPLICATE_SUPPRESSION_MS,
  installRuntimeFailureCapture,
  recordRuntimeFailure,
  readRuntimeFailures,
  describeThrown,
  describeWindowErrorEvent,
  formatRuntimeFailureLine,
  failureClockText,
  resolveDiagnosticsWindow,
  type RuntimeFailure,
} from '@/runtimeDiagnostics';

const REPO = path.resolve(__dirname, '..', '..');

/** Map-backed storage fake with a real write counter. */
function makeStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  let writes = 0;
  return {
    store,
    get writes() {
      return writes;
    },
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => {
      store[key] = value;
      writes += 1;
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
  };
}
type FakeStorage = ReturnType<typeof makeStorage>;

/** Deterministic clock holder (the ring stamps with the injected `now`). */
function makeClock(start = 1_700_000_000_000) {
  let at = start;
  return {
    now: () => at,
    advance: (ms: number): void => {
      at += ms;
    },
  };
}

function readRing(storage: FakeStorage): RuntimeFailure[] {
  const raw = storage.store[DIAGNOSTICS_KEY];
  return raw === undefined ? [] : (JSON.parse(raw) as RuntimeFailure[]);
}

describe('recordRuntimeFailure — bounded ring', () => {
  it('appends oldest-first and caps at MAX_RECORDED_FAILURES, evicting the oldest', () => {
    const storage = makeStorage();
    const clock = makeClock();
    for (let i = 0; i < MAX_RECORDED_FAILURES + 5; i++) {
      recordRuntimeFailure({ storage, now: clock.now }, { kind: 'error', message: `failure ${i}` });
      clock.advance(DUPLICATE_SUPPRESSION_MS); // outside suppression so every write lands
    }
    const ring = readRing(storage);
    expect(ring).toHaveLength(MAX_RECORDED_FAILURES);
    expect(ring[0].message).toBe('failure 5'); // the five oldest + the seed evicted
    expect(ring[ring.length - 1].message).toBe(`failure ${MAX_RECORDED_FAILURES + 4}`);
  });

  it('clamps each message at FAILURE_MESSAGE_LIMIT', () => {
    const storage = makeStorage();
    recordRuntimeFailure({ storage, now: () => 5 }, { kind: 'rejection', message: 'x'.repeat(FAILURE_MESSAGE_LIMIT + 100) });
    expect(readRing(storage)[0].message).toHaveLength(FAILURE_MESSAGE_LIMIT);
  });

  it('suppresses a consecutive identical kind+message inside the burst window (ONE write)', () => {
    const storage = makeStorage();
    for (let i = 0; i < 50; i++) recordRuntimeFailure({ storage, now: () => 9 }, { kind: 'error', message: 'loop died' });
    expect(storage.writes).toBe(1);
    expect(readRing(storage)).toHaveLength(1);
  });

  it('records the SAME message again once the suppression window has elapsed', () => {
    const storage = makeStorage();
    const clock = makeClock();
    recordRuntimeFailure({ storage, now: clock.now }, { kind: 'error', message: 'flaky' });
    clock.advance(DUPLICATE_SUPPRESSION_MS);
    recordRuntimeFailure({ storage, now: clock.now }, { kind: 'error', message: 'flaky' });
    expect(readRing(storage)).toHaveLength(2);
  });

  it('writes nothing when setItem throws (quota / privacy-mode storage)', () => {
    const storage = makeStorage();
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => recordRuntimeFailure({ storage, now: () => 1 }, { kind: 'error', message: 'boom' })).not.toThrow();
  });

  it('never throws even when getItem throws', () => {
    const storage = makeStorage();
    storage.getItem = () => {
      throw new Error('SecurityError');
    };
    expect(() => recordRuntimeFailure({ storage, now: () => 1 }, { kind: 'boot-fatal', message: 'x' })).not.toThrow();
  });
});

describe('readRuntimeFailures — parse, never trust', () => {
  it('empty storage reads as []', () => {
    expect(readRuntimeFailures(makeStorage())).toEqual([]);
  });

  it('corrupt JSON, non-array payloads and malformed entries degrade to []', () => {
    expect(readRuntimeFailures(makeStorage({ [DIAGNOSTICS_KEY]: '{oops' }))).toEqual([]);
    expect(readRuntimeFailures(makeStorage({ [DIAGNOSTICS_KEY]: '{"a":1}' }))).toEqual([]);
    expect(readRuntimeFailures(makeStorage({ [DIAGNOSTICS_KEY]: '[3, null, "s"]' }))).toEqual([]);
  });

  it('drops the bad rows and keeps the good ones; an unknown persisted kind degrades to error', () => {
    const raw = JSON.stringify([
      { kind: 'vue', message: 'good', at: 10 },
      { kind: 'nonsense-kind', message: 'also-good', at: 20 },
      { kind: 'error', at: 30 }, // no message → dropped
      { kind: 'error', message: 'x', at: 'soon' }, // bad stamp → dropped
    ]);
    expect(readRuntimeFailures(makeStorage({ [DIAGNOSTICS_KEY]: raw }))).toEqual([
      { kind: 'vue', message: 'good', at: 10 },
      { kind: 'error', message: 'also-good', at: 20 },
    ]);
  });

  it('reads [] when getItem throws', () => {
    const storage = makeStorage();
    storage.getItem = () => {
      throw new Error('SecurityError');
    };
    expect(readRuntimeFailures(storage)).toEqual([]);
  });
});

describe('describeThrown / describeWindowErrorEvent', () => {
  it('names an Error "TypeError: …" style (the useful token on a support call)', () => {
    expect(describeThrown(new TypeError('x is undefined'))).toBe('TypeError: x is undefined');
  });

  it('passes strings through and coerces other values', () => {
    expect(describeThrown('plain string')).toBe('plain string');
    expect(describeThrown(42)).toBe('42');
    expect(describeThrown(undefined)).toBe('undefined');
    expect(describeThrown(null)).toBe('null');
  });

  it('survives a hostile toString', () => {
    const hostile = {
      toString() {
        throw new Error('nope');
      },
    };
    expect(describeThrown(hostile)).toBe('unstringable value');
  });

  it('composes the window error line from message + file + line', () => {
    const event = { message: 'boom', filename: 'app://-/assets/index.js', lineno: 7 } as unknown as Event;
    expect(describeWindowErrorEvent(event)).toBe('boom @ app://-/assets/index.js:7');
  });

  it('degrades honestly without a message, and without a line', () => {
    expect(describeWindowErrorEvent({ filename: 'x.js' } as unknown as Event)).toBe('Uncaught error @ x.js');
    expect(describeWindowErrorEvent({ message: 'm', filename: 'x.js' } as unknown as Event)).toBe('m @ x.js');
    expect(describeWindowErrorEvent(new Event('error'))).toBe('Uncaught error');
  });
});

interface FakeWindow {
  listeners: Map<string, Array<(event: Event) => void>>;
  addEventListener(type: string, handler: (event: Event) => void): void;
  removeEventListener(type: string, handler: (event: Event) => void): void;
  fire(type: string, event: Event): void;
}

function makeWindow(): FakeWindow {
  const listeners = new Map<string, Array<(event: Event) => void>>();
  return {
    listeners,
    addEventListener(type, handler) {
      const list = listeners.get(type) ?? [];
      list.push(handler);
      listeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = (listeners.get(type) ?? []).filter((candidate) => candidate !== handler);
      listeners.set(type, list);
    },
    fire(type, event) {
      for (const handler of listeners.get(type) ?? []) handler(event);
    },
  };
}

describe('installRuntimeFailureCapture — window wiring', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers exactly the error + unhandledrejection listeners', () => {
    const target = makeWindow();
    const handle = installRuntimeFailureCapture({ storage: makeStorage(), target });
    expect([...target.listeners.keys()].sort()).toEqual(['error', 'unhandledrejection']);
    expect(target.listeners.get('error')).toHaveLength(1);
    expect(target.listeners.get('unhandledrejection')).toHaveLength(1);
    handle.dispose();
  });

  it('an error event lands in the persisted ring as kind error', () => {
    const storage = makeStorage();
    const target = makeWindow();
    installRuntimeFailureCapture({ storage, now: () => 111, target });
    target.fire('error', { message: 'socket died', filename: 'a.js', lineno: 3 } as unknown as Event);
    expect(readRing(storage)).toEqual([{ kind: 'error', message: 'socket died @ a.js:3', at: 111 }]);
  });

  it('an unhandledrejection lands as kind rejection with the summarized reason', () => {
    const storage = makeStorage();
    const target = makeWindow();
    installRuntimeFailureCapture({ storage, now: () => 222, target });
    const event = new Event('unhandledrejection');
    Object.defineProperty(event, 'reason', { value: new Error('no refresh token') });
    target.fire('unhandledrejection', event);
    expect(readRing(storage)).toEqual([{ kind: 'rejection', message: 'Error: no refresh token', at: 222 }]);
  });

  it('a hostile event getter does not take the capture down (handler never rethrows)', () => {
    const storage = makeStorage();
    const target = makeWindow();
    installRuntimeFailureCapture({ storage, target });
    const hostile = new Event('error');
    Object.defineProperty(hostile, 'message', {
      get() {
        throw new Error('hostile getter');
      },
    });
    expect(() => target.fire('error', hostile)).not.toThrow();
  });

  it('dispose removes both listeners — later events change nothing', () => {
    const storage = makeStorage();
    const target = makeWindow();
    const handle = installRuntimeFailureCapture({ storage, target });
    handle.dispose();
    handle.dispose(); // idempotent
    expect(target.listeners.get('error')).toEqual([]);
    expect(target.listeners.get('unhandledrejection')).toEqual([]);
    target.fire('error', { message: 'late' } as unknown as Event);
    expect(storage.writes).toBe(0);
  });

  it('the handle.record bridge (the Vue errorHandler leg in boot) feeds the same ring', () => {
    const storage = makeStorage();
    const handle = installRuntimeFailureCapture({ storage, now: () => 333, target: makeWindow() });
    handle.record({ kind: 'vue', message: 'TypeError: x (render function)' });
    expect(readRing(storage)).toEqual([{ kind: 'vue', message: 'TypeError: x (render function)', at: 333 }]);
  });

  it('target null degrades to a recorder with a no-op dispose (node / hostile hosts)', () => {
    const storage = makeStorage();
    const handle = installRuntimeFailureCapture({ storage, now: () => 444, target: null });
    expect(() => handle.dispose()).not.toThrow();
    handle.record({ kind: 'error', message: 'still lands' });
    expect(readRing(storage)).toEqual([{ kind: 'error', message: 'still lands', at: 444 }]);
  });

  it('resolveDiagnosticsWindow finds the jsdom window and refuses a broken one', () => {
    expect(resolveDiagnosticsWindow()).toBe(globalThis.window as unknown as ReturnType<typeof resolveDiagnosticsWindow>);
    vi.stubGlobal('window', { addEventListener: 'not-a-function' });
    expect(resolveDiagnosticsWindow()).toBeNull();
    vi.stubGlobal('window', undefined);
    expect(resolveDiagnosticsWindow()).toBeNull();
  });
});

describe('line formatting for the boot-failure surface', () => {
  it('renders [kind] HH:MM:SS UTC message', () => {
    const at = Date.UTC(2026, 9, 29, 7, 19, 16);
    expect(failureClockText(at)).toBe('07:19:16');
    expect(formatRuntimeFailureLine({ kind: 'rejection', message: 'boom', at })).toBe('[rejection] 07:19:16 boom');
  });

  it('an unusable stamp degrades to --:--:-- instead of throwing', () => {
    expect(failureClockText(1e300)).toBe('--:--:--');
  });
});

describe('estate honesty laws (source greps)', () => {
  // Same family as the gamepadBridge/DigitBuffer grep pins: scan the CODE,
  // with the docblock (which quotes the banned names to explain why) removed.
  const code = readFileSync(path.join(REPO, 'src', 'runtimeDiagnostics.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('zero network — this is visibility, not a crash uploader', () => {
    for (const banned of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'navigator.']) {
      expect(code, `expected no ${banned} in runtimeDiagnostics code`).not.toContain(banned);
    }
  });

  it('zero platform reach — no tizen.* (the S503 privilege mask stays intact)', () => {
    expect(code).not.toContain('tizen.');
    expect(code).not.toContain('webapis');
  });

  it('old-webview API floor — no Chrome-92+ runtime APIs above the declared envelope', () => {
    // .at( would need Chrome 92, Object.hasOwn 93, structuredClone 98; the
    // module must run on the pre-98 field population polyfills.ts documents.
    expect(code).not.toContain('.at(');
    expect(code).not.toContain('Object.hasOwn');
    expect(code).not.toContain('structuredClone');
  });
});
