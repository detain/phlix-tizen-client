/**
 * Guarded localStorage accessor shared by the screensaver overlay and the TV
 * settings page: the real localStorage when the webview allows it, otherwise a
 * session-scoped in-memory shim (the privacy-mode getter can throw).
 */
export type GuardedStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createGuardedStorage(): GuardedStorage {
  try {
    const real = globalThis.localStorage;
    if (real) return real;
  } catch {
    // privacy-mode getter threw — session shim below
  }
  const memory = new Map<string, string>();
  return {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
    removeItem: (k: string) => {
      memory.delete(k);
    },
  };
}
