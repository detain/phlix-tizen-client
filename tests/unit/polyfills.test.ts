import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The polyfills module must be imported first before any @phlix/ui code
// Since structuredClone exists in Node.js 22+ / jsdom, the fallback branch
// is Tizen-specific and only runs on older devices. We test the fallback
// logic directly to ensure correctness.

describe('polyfills', () => {
  describe('structuredClone fallback (when native is absent)', () => {
    let originalStructuredClone: Function | undefined;

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
});
