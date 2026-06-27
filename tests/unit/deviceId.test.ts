import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveDeviceId } from '@/deviceId';

function makeStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    store,
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    })
  };
}

describe('resolveDeviceId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('generates a tizen-prefixed id and persists it on first call', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1234' });
    const storage = makeStorage();
    const id = resolveDeviceId(storage);
    expect(id).toBe('tizen-uuid-1234');
    expect(storage.setItem).toHaveBeenCalledWith('phlix.deviceId', 'tizen-uuid-1234');
    expect(storage.store['phlix.deviceId']).toBe('tizen-uuid-1234');
  });

  it('returns the persisted id on subsequent calls without regenerating', () => {
    const randomUUID = vi.fn(() => 'uuid-5678');
    vi.stubGlobal('crypto', { randomUUID });
    const storage = makeStorage({ 'phlix.deviceId': 'tizen-existing' });
    const id = resolveDeviceId(storage);
    expect(id).toBe('tizen-existing');
    expect(randomUUID).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('is stable across two calls against the same storage', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-stable' });
    const storage = makeStorage();
    const first = resolveDeviceId(storage);
    const second = resolveDeviceId(storage);
    expect(first).toBe(second);
  });

  it('falls back to a timestamp+counter id when crypto.randomUUID is absent', () => {
    vi.stubGlobal('crypto', {});
    const storage = makeStorage();
    const id = resolveDeviceId(storage);
    expect(id).toMatch(/^tizen-[a-z0-9]+-[a-z0-9]+$/);
    expect(storage.store['phlix.deviceId']).toBe(id);
  });
});
