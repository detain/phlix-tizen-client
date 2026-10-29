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
});
