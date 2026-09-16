import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  REMOTE_KEYS,
  registerRemoteKeys,
  unregisterRemoteKeys,
  installRemoteKeyRegistration,
  type TizenLike,
  type TvInputDeviceLike
} from '@/remote/registerKeys';

/**
 * A hand-built `tizen.tvinputdevice` double — the whole point of registerKeys.ts
 * being pure + structural is that no ambient Tizen is needed to exercise it.
 */
function makeTizen(opts: { throws?: Set<string> } = {}): TizenLike & {
  device: TvInputDeviceLike;
  registered: string[];
  unregistered: string[];
} {
  const registered: string[] = [];
  const unregistered: string[] = [];
  const device: TvInputDeviceLike = {
    registerKey: vi.fn((key: string) => {
      if (opts.throws?.has(key)) {
        throw new Error(`NotSupportedError: ${key}`);
      }
      registered.push(key);
      return true;
    }),
    unregisterKey: vi.fn((key: string) => {
      unregistered.push(key);
      return true;
    })
  };
  return { tvinputdevice: device, device, registered, unregistered };
}

describe('registerKeys (S509 — AD-1)', () => {
  afterEach(() => {
    delete (globalThis as { tizen?: unknown }).tizen;
  });

  it('registers the full documented media / channel / colour key set', () => {
    const tizen = makeTizen();
    const held = registerRemoteKeys(undefined, tizen);
    expect(tizen.device.registerKey).toHaveBeenCalledTimes(REMOTE_KEYS.length);
    expect(held).toEqual(REMOTE_KEYS);
    // The brief's transport set is all present by name.
    for (const name of [
      'MediaPlay',
      'MediaPause',
      'MediaStop',
      'MediaNext',
      'MediaPrevious',
      'MediaRewind',
      'MediaFastForward'
    ]) {
      expect(REMOTE_KEYS).toContain(name);
    }
  });

  it('reports the names it actually acquired (registration is what teardown releases)', () => {
    const tizen = makeTizen();
    const held = registerRemoteKeys(['MediaPlay', 'MediaStop'], tizen);
    expect(held).toEqual(['MediaPlay', 'MediaStop']);
    expect(tizen.registered).toEqual(['MediaPlay', 'MediaStop']);
  });

  it('skips a key the profile rejects instead of aborting the set (fail-soft per key)', () => {
    const tizen = makeTizen({ throws: new Set(['Colors']) });
    const held = registerRemoteKeys(['MediaPlay', 'Colors', 'MediaStop'], tizen);
    expect(held).toEqual(['MediaPlay', 'MediaStop']);
    expect(tizen.registered).toEqual(['MediaPlay', 'MediaStop']);
  });

  it('is a silent no-op when the platform API is absent (browser dev / jsdom)', () => {
    const empty: TizenLike = {};
    expect(registerRemoteKeys(undefined, empty)).toEqual([]);
    // No ambient global either.
    expect(registerRemoteKeys()).toEqual([]);
  });

  it('reads the ambient `tizen` global when no double is injected', () => {
    const tizen = makeTizen();
    (globalThis as { tizen?: unknown }).tizen = tizen;
    const held = registerRemoteKeys(['MediaPlay']);
    expect(held).toEqual(['MediaPlay']);
    expect(tizen.device.registerKey).toHaveBeenCalledWith('MediaPlay');
  });

  it('unregisterRemoteKeys releases the given names, tolerating platform throws', () => {
    const unregistered: string[] = [];
    const device: TvInputDeviceLike = {
      registerKey: vi.fn(() => true),
      unregisterKey: vi.fn((key: string) => {
        if (key === 'MediaStop') throw new Error('boom');
        unregistered.push(key);
        return true;
      })
    };
    expect(() =>
      unregisterRemoteKeys(['MediaPlay', 'MediaStop'], { tvinputdevice: device })
    ).not.toThrow();
    expect(unregistered).toEqual(['MediaPlay']);
  });

  it('installRemoteKeyRegistration pairs release of EXACTLY what it registered', () => {
    const tizen = makeTizen({ throws: new Set(['Info']) });
    const teardown = installRemoteKeyRegistration(tizen);
    // Everything but the rejected 'Info' was acquired.
    expect(tizen.registered).toEqual(REMOTE_KEYS.filter((k) => k !== 'Info'));

    teardown();
    // Teardown released precisely that acquired subset — no over-unregister, no leak.
    expect(tizen.unregistered).toEqual(REMOTE_KEYS.filter((k) => k !== 'Info'));
  });

  it('installRemoteKeyRegistration teardown is a safe no-op on a non-Tizen webview', () => {
    const teardown = installRemoteKeyRegistration({});
    expect(() => teardown()).not.toThrow();
  });
});
