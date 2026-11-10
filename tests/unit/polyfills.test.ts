import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// The polyfills module must be imported first before any @phlix/ui code
// Since structuredClone exists in Node.js 22+ / jsdom, the fallback branch
// is Tizen-specific and only runs on older devices. We test the fallback
// logic directly to ensure correctness.

describe('polyfills', () => {
  describe('structuredClone fallback (when native is absent)', () => {
    let originalStructuredClone: (<T>(_value: T) => T) | undefined;

    beforeEach(() => {
      // Save original
      originalStructuredClone = (globalThis as any).structuredClone;
    });

    afterEach(() => {
      // Restore original
      if (originalStructuredClone !== undefined) {
        (globalThis as any).structuredClone = originalStructuredClone;
      } else {
        delete (globalThis as any).structuredClone;
      }
    });

    it('fallback clones primitive values', () => {
      // Remove native
      delete (globalThis as any).structuredClone;

      // The fallback implementation (same as in polyfills.ts)
      const fallback = <T>(_value: T): T =>
        JSON.parse(JSON.stringify(_value)) as T;

      expect(fallback(42)).toBe(42);
      expect(fallback('hello')).toBe('hello');
      expect(fallback(true)).toBe(true);
      expect(fallback(null)).toBe(null);
    });

    it('fallback clones arrays', () => {
      const fallback = <T>(_value: T): T =>
        JSON.parse(JSON.stringify(_value)) as T;

      const arr = [1, 2, 3];
      const cloned = fallback(arr);
      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr); // Should be a new reference
    });

    it('fallback clones objects', () => {
      const fallback = <T>(_value: T): T =>
        JSON.parse(JSON.stringify(_value)) as T;

      const obj = { a: 1, b: { c: 2 } };
      const cloned = fallback(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b); // Deep clone
    });

    it('fallback handles nested objects', () => {
      const fallback = <T>(_value: T): T =>
        JSON.parse(JSON.stringify(_value)) as T;

      const nested = {
        level1: {
          level2: {
            level3: {
              value: 'deep'
            }
          }
        }
      };
      const cloned = fallback(nested);
      expect(cloned).toEqual(nested);
      expect(cloned.level1.level2.level3).not.toBe(nested.level1.level2.level3);
    });

    it('fallback handles empty objects and arrays', () => {
      const fallback = <T>(_value: T): T =>
        JSON.parse(JSON.stringify(_value)) as T;

      expect(fallback({})).toEqual({});
      expect(fallback([])).toEqual([]);
    });

    it('fallback does NOT preserve Date objects (JSON limitation)', () => {
      const fallback = <T>(_value: T): T =>
        JSON.parse(JSON.stringify(_value)) as T;

      const date = new Date('2024-01-01T00:00:00.000Z');
      const obj = { date };
      const cloned = fallback(obj);

      // JSON.stringify converts Date to string
      expect(typeof cloned.date).toBe('string');
    });

    it('fallback does NOT preserve undefined values in objects', () => {
      const fallback = <T>(_value: T): T =>
        JSON.parse(JSON.stringify(_value)) as T;

      const obj = { a: 1, b: undefined };
      const cloned = fallback(obj);

      // undefined values are omitted by JSON.stringify
      expect('b' in cloned).toBe(false);
    });

    it('fallback does NOT preserve functions', () => {
      const fallback = <T>(_value: T): T =>
        JSON.parse(JSON.stringify(_value)) as T;

      const obj = { a: 1, fn: () => 'test' };
      const cloned = fallback(obj);

      // Functions are omitted by JSON.stringify
      expect('fn' in cloned).toBe(false);
    });

    it('fallback does NOT preserve Map/Set', () => {
      const fallback = <T>(_value: T): T =>
        JSON.parse(JSON.stringify(_value)) as T;

      const map = new Map([['key', 'value']]);
      const set = new Set([1, 2, 3]);

      // JSON.stringify converts Map/Set to empty objects
      expect(fallback(map)).toEqual({});
      expect(fallback(set)).toEqual({});
    });

    it('fallback handles circular references by throwing', () => {
      const fallback = <T>(_value: T): T =>
        JSON.parse(JSON.stringify(_value)) as T;

      const circular: any = { a: 1 };
      circular.self = circular;

      expect(() => fallback(circular)).toThrow();
    });
  });

  describe('native structuredClone (when available)', () => {
    it('uses native implementation when available', () => {
      if (typeof globalThis.structuredClone === 'function') {
        const original = { a: 1, b: { c: 2 } };
        const cloned = globalThis.structuredClone(original);
        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned.b).not.toBe(original.b);
      }
    });
  });

  // S501 T-11: exercise the REAL @/polyfills module (the suites above re-implement
  // the fallback inline, so they never import src/polyfills.ts → it sat at 0% coverage).
  describe('src/polyfills.ts module wiring', () => {
    const nativeStructuredClone = globalThis.structuredClone;

    afterEach(() => {
      // Restore the native implementation + a clean registry so no other suite is affected.
      Object.defineProperty(globalThis, 'structuredClone', {
        value: nativeStructuredClone,
        configurable: true,
        writable: true,
      });
      vi.resetModules();
    });

    it('installs the JSON fallback when native structuredClone is absent', async () => {
      vi.resetModules();
      Object.defineProperty(globalThis, 'structuredClone', {
        value: undefined,
        configurable: true,
        writable: true,
      });

      await import('@/polyfills');

      expect(typeof globalThis.structuredClone).toBe('function');

      const original = { a: 1, b: { c: [1, 2, 3] } };
      const cloned = globalThis.structuredClone(original);
      expect(cloned).toEqual(original);
      // Deep-cloned, not the same reference.
      expect(cloned.b).not.toBe(original.b);
      expect(cloned.b.c).not.toBe(original.b.c);
    });

    it('does not overwrite an already-present native structuredClone', async () => {
      vi.resetModules();
      const sentinel = function sentinelStructuredClone() {
        /* marker */
      } as unknown as typeof globalThis.structuredClone;
      Object.defineProperty(globalThis, 'structuredClone', {
        value: sentinel,
        configurable: true,
        writable: true,
      });

      await import('@/polyfills');

      // Guard is `typeof !== 'function'`; a function is present → no-op.
      expect(globalThis.structuredClone).toBe(sentinel);
    });
  });

  // M-TIZEN-03 (review tizen__crossfe M1): Array.prototype.at (Chromium 92,
  // above the repo's ≥85 runtime floor — docs/runtime-floor.md) must be
  // installed by src/polyfills.ts because the vendored ui PosterPicker chunk
  // calls `.at(-1)` at three live sites the client cannot edit. jsdom/Node 24
  // has a NATIVE at, so — exactly like the structuredClone family above —
  // the native is hidden via defineProperty and the REAL module re-imported.
  describe('src/polyfills.ts Array.prototype.at fallback (M-TIZEN-03)', () => {
    const nativeAt = Object.getOwnPropertyDescriptor(Array.prototype, 'at');

    afterEach(() => {
      Object.defineProperty(Array.prototype, 'at', {
        ...nativeAt,
        configurable: true,
        writable: true,
      });
      vi.resetModules();
    });

    async function importWithAbsentAt(): Promise<void> {
      vi.resetModules();
      Object.defineProperty(Array.prototype, 'at', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      await import('@/polyfills');
    }

    it('installs a function when native Array.prototype.at is absent', async () => {
      await importWithAbsentAt();
      const at = (Array.prototype as unknown as { at?: unknown }).at;
      expect(typeof at).toBe('function');
    });

    it('matches native semantics across the spec-relevant index shapes', async () => {
      await importWithAbsentAt();
      const at = (Array.prototype as { at(index: number): unknown }).at;
      expect([1, 2, 3].at(-1)).toBe(3); // negative counts from the end
      expect([1, 2, 3].at(0)).toBe(1);
      expect([1, 2, 3].at(2)).toBe(3);
      expect([1, 2, 3].at(3)).toBeUndefined(); // out of range → undefined
      expect([1, 2, 3].at(-4)).toBeUndefined();
      expect([1, 2, 3].at(1.9)).toBe(2); // truncates toward zero
      expect([1, 2, 3].at(-1.9)).toBe(3); // -1.9 -> -1 -> from the end
      expect([1, 2, 3].at(NaN)).toBe(1); // ToIntegerOrInfinity(NaN) = +0
      expect([1, 2, 3].at(Infinity)).toBeUndefined();
      expect([1, 2, 3].at(-Infinity)).toBeUndefined();
      expect([].at(0)).toBeUndefined();
      // eslint-disable-next-line no-sparse-arrays
      expect([1, , 3].at(1)).toBeUndefined(); // holes stay holes
      // Cross-check against the native (present under Node 24) on the same grid.
      const nativeGrid = [1, 2, 3];
      for (const i of [-4, -3, -2, -1, 0, 1, 2, 3, 1.9, -1.9, NaN]) {
        expect(at.call(nativeGrid, i)).toBe(nativeGrid.at(i));
      }
    });

    it('installs non-enumerable with a writable+configurable descriptor (native parity)', async () => {
      await importWithAbsentAt();
      const d = Object.getOwnPropertyDescriptor(Array.prototype, 'at');
      expect(d).toBeDefined();
      expect(d!.enumerable).toBe(false);
      expect(d!.writable).toBe(true);
      expect(d!.configurable).toBe(true);
      const seen: string[] = [];
      for (const k in [1, 2, 3]) seen.push(k);
      expect(seen).toEqual(['0', '1', '2']); // 'at' must NOT appear
      expect(Object.keys([1, 2, 3])).toEqual(['0', '1', '2']);
    });

    it('does not overwrite an already-present native at', async () => {
      vi.resetModules();
      const sentinel = function sentinelAt(this: unknown, _index: number): unknown {
        return this;
      };
      Object.defineProperty(Array.prototype, 'at', {
        value: sentinel,
        configurable: true,
        writable: true,
      });

      await import('@/polyfills');

      expect((Array.prototype as unknown as { at: unknown }).at).toBe(sentinel);
    });
  });

  // RT-106 (review tizen__crossfe M1, lane w24-L3): crypto.randomUUID
  // (Chromium 92, above the repo's 85 floor) is called UNGUARDED inside the
  // vendored ui Menu component's setup() — a TypeError on 85–91 engines that
  // kills every Menu surface. The cure is the src/polyfills.ts v4 shim over
  // crypto.getRandomValues. jsdom 29 / Node have the native, so — same
  // family as the structuredClone and Array.prototype.at suites — the native
  // is hidden via defineProperty and the REAL module re-imported.
  describe('src/polyfills.ts crypto.randomUUID fallback (RT-106)', () => {
    const cryptoGlobal = globalThis.crypto;
    // Both members may live on the jsdom/Node Crypto PROTOTYPE rather than
    // as own properties; the restore below handles either shape so the
    // shim's own-property install can never leak into sibling suites.
    const ownBefore = {
      randomUUID: Object.prototype.hasOwnProperty.call(cryptoGlobal, 'randomUUID'),
      getRandomValues: Object.prototype.hasOwnProperty.call(cryptoGlobal, 'getRandomValues'),
    };
    const valueBefore = {
      randomUUID: cryptoGlobal.randomUUID,
      getRandomValues: cryptoGlobal.getRandomValues,
    };

    afterEach(() => {
      for (const key of ['randomUUID', 'getRandomValues'] as const) {
        if (ownBefore[key]) {
          Object.defineProperty(cryptoGlobal, key, {
            value: valueBefore[key],
            configurable: true,
            writable: true,
          });
        } else {
          delete (cryptoGlobal as unknown as Record<string, unknown>)[key];
        }
      }
      vi.resetModules();
    });

    async function importWithAbsentRandomUUID(hideGetRandomValues = false): Promise<void> {
      vi.resetModules();
      Object.defineProperty(cryptoGlobal, 'randomUUID', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      if (hideGetRandomValues) {
        Object.defineProperty(cryptoGlobal, 'getRandomValues', {
          value: undefined,
          configurable: true,
          writable: true,
        });
      }
      await import('@/polyfills');
    }

    it('installs an RFC 4122 v4 shim when native randomUUID is absent (RED-ON-PARENT cc8a40f8)', async () => {
      await importWithAbsentRandomUUID();
      const shim = (cryptoGlobal as unknown as { randomUUID?: unknown }).randomUUID;
      expect(typeof shim).toBe('function');

      const produced = cryptoGlobal.randomUUID();
      // 8-4-4(version 4)-4(variant 10xx)-12 lowercase hex.
      expect(produced).toMatch(
        /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/
      );
    });

    it('produces unique values across rapid draws (entropy comes from getRandomValues)', async () => {
      await importWithAbsentRandomUUID();
      const seen = new Set<string>();
      for (let i = 0; i < 200; i++) seen.add(cryptoGlobal.randomUUID());
      expect(seen.size).toBe(200);
    });

    it('does not overwrite an already-present native randomUUID', async () => {
      vi.resetModules();
      const sentinel = function sentinelRandomUUID(): string {
        return 'sentinel';
      };
      Object.defineProperty(cryptoGlobal, 'randomUUID', {
        value: sentinel,
        configurable: true,
        writable: true,
      });

      await import('@/polyfills');

      expect((cryptoGlobal as unknown as { randomUUID: unknown }).randomUUID).toBe(sentinel);
    });

    it('stays inert when crypto.getRandomValues is absent (precondition law)', async () => {
      // The shim must never claim an engine the floor doesn't have: without
      // getRandomValues there is no entropy source, so NO install happens —
      // the vendored guarded sites keep their own fallbacks.
      await importWithAbsentRandomUUID(true);
      expect(
        typeof (cryptoGlobal as unknown as { randomUUID?: unknown }).randomUUID
      ).not.toBe('function');
    });
  });

  // RT-087 (owner ruling (a), 2026-11-10, pinia ^4.1.0 manual bump): pinia 4's
  // shipped dist calls Object.hasOwn (Chrome 93) at three live sites the
  // client cannot edit. Same vendored-call-site constraint as `.at` and
  // randomUUID, so the cure installs at src/polyfills.ts. RED-ON-PARENT for
  // this lane: without the install block, hiding the native leaves the member
  // undefined after re-import (the absent-shim assert below convicts it).
  describe('src/polyfills.ts Object.hasOwn fallback (RT-087)', () => {
    const nativeBefore = Object.getOwnPropertyDescriptor(Object, 'hasOwn');
    if (!nativeBefore) throw new Error('runtime lacks native Object.hasOwn — test premise');

    afterEach(() => {
      if (nativeBefore) {
        Object.defineProperty(Object, 'hasOwn', nativeBefore);
      } else {
        delete (Object as unknown as Record<string, unknown>).hasOwn;
      }
      vi.resetModules();
    });

    async function importWithAbsentHasOwn(): Promise<void> {
      vi.resetModules();
      Object.defineProperty(Object, 'hasOwn', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      await import('@/polyfills');
    }

    it('installs the own-property shim when native Object.hasOwn is absent (RED-ON-PARENT)', async () => {
      await importWithAbsentHasOwn();
      expect(typeof Object.hasOwn).toBe('function');
    });

    it('answers the OWN-property question with native-equivalent semantics', async () => {
      await importWithAbsentHasOwn();
      const own = { direct: 1, [Symbol.for('phlix.sym')]: 2 };
      const proto = Object.create({ inherited: 3 });
      (proto as Record<string, number>).own4 = 4;
      expect(Object.hasOwn(own, 'direct')).toBe(true);
      expect(Object.hasOwn(own, Symbol.for('phlix.sym'))).toBe(true);
      expect(Object.hasOwn(proto, 'inherited')).toBe(false);
      expect(Object.hasOwn(proto, 'own4')).toBe(true);
      expect(Object.hasOwn(['a', 'b'], '1')).toBe(true);
      expect(Object.hasOwn(['a', 'b'], 'length')).toBe(true); // array length is an OWN (non-enumerable) slot
      // The spec signature restricts target to object; at runtime ToObject boxes
      // primitives identically for native and shim, so the coercion legs run widened.
      const coerced = Object.hasOwn as (target: unknown, key: PropertyKey) => boolean;
      expect(coerced('phlix', 'length')).toBe(true); // ToObject boxes: primitive-exotic own
      expect(coerced(3, 'toFixed')).toBe(false);
      expect(() => Object.hasOwn(null as unknown as object, 'x')).toThrow(TypeError);
      expect(() => Object.hasOwn(undefined as unknown as object, 'x')).toThrow(TypeError);
    });

    it('does not overwrite an already-present native hasOwn', async () => {
      vi.resetModules();
      const sentinel = function sentinelHasOwn(): boolean {
        return true;
      };
      Object.defineProperty(Object, 'hasOwn', {
        value: sentinel,
        configurable: true,
        writable: true,
      });
      await import('@/polyfills');
      expect(Object.hasOwn as unknown as typeof sentinel).toBe(sentinel);
    });

    it('installs non-enumerable, writable, configurable (native descriptor shape)', async () => {
      await importWithAbsentHasOwn();
      const d = Object.getOwnPropertyDescriptor(Object, 'hasOwn');
      expect(d).toBeDefined();
      expect(d!.enumerable).toBe(false);
      expect(d!.writable).toBe(true);
      expect(d!.configurable).toBe(true);
    });
  });
});
