/**
 * S298 — the Tizen load-a-new-title dispatch point (`src/syncplayDispatch.ts`).
 *
 * A delivered `pending_command` / `play_media` frame carries ONLY a media id +
 * title; this module is what turns it into playback: resolve the id through
 * the app's ApiClient, `setCurrent` on the shared @phlix/ui player, `play`,
 * and consume the store slot. Mirrors the ui's Player.vue load path,
 * including the stale-resolution guard (a newer command wins over a slow
 * resolution) and the unresolved fallback (command NOT consumed, host
 * notified).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reactive, nextTick } from 'vue';
import { wirePendingPlayMediaDispatcher, type PendingPlayMediaStore, type PendingPlayMediaPlayer } from '@/syncplayDispatch';
import type { PendingPlayMediaCommand } from '@/api/hubRelay';

function command(over: Partial<PendingPlayMediaCommand> = {}): PendingPlayMediaCommand {
  return {
    type: 'pending_command',
    command: 'play_media',
    serverId: 'srv-abc123',
    mediaId: 'media-9',
    title: 'Inception',
    issuedAt: 1_700_000_000,
    source: 'alexa',
    ...over,
  };
}

/**
 * A pinia-shaped store fake: `pendingPlayMedia` is a REACTIVE property on the
 * store object (pinia unwraps state refs onto the store instance exactly this
 * way), so the dispatcher's `watch` getter reacts to assignments the same way
 * it does against the real store.
 */
function fakeStore(): PendingPlayMediaStore {
  const state = reactive<{ pendingPlayMedia: PendingPlayMediaCommand | null }>({
    pendingPlayMedia: null,
  });
  return {
    get pendingPlayMedia() {
      return state.pendingPlayMedia;
    },
    set pendingPlayMedia(command: PendingPlayMediaCommand | null) {
      state.pendingPlayMedia = command;
    },
    consumePendingPlayMedia: vi.fn(() => {
      state.pendingPlayMedia = null;
    }),
  };
}

function fakePlayer(): PendingPlayMediaPlayer & { setCurrent: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn> } {
  return { setCurrent: vi.fn(), play: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('wirePendingPlayMediaDispatcher — the load-a-new-title path', () => {
  it('loads the resolved title: setCurrent + play + consume', async () => {
    const store = fakeStore();
    const player = fakePlayer();
    const item = { id: 'media-9', name: 'Inception', type: 'movie' };
    const resolveMedia = vi.fn(async () => item);
    const unwatch = wirePendingPlayMediaDispatcher(store, { resolveMedia, player });
    try {
      store.pendingPlayMedia = command();
      await nextTick();
      await nextTick();

      expect(resolveMedia).toHaveBeenCalledWith({ mediaId: 'media-9', title: 'Inception' });
      expect(player.setCurrent).toHaveBeenCalledWith(item, { resetPosition: true });
      expect(player.play).toHaveBeenCalledTimes(1);
      expect(store.pendingPlayMedia).toBeNull(); // consumed
    } finally {
      unwatch();
    }
  });

  it('leaves the command unconsumed and notifies onUnresolved when resolution returns null', async () => {
    const store = fakeStore();
    const player = fakePlayer();
    const onUnresolved = vi.fn();
    const resolveMedia = vi.fn(async () => null);
    const unwatch = wirePendingPlayMediaDispatcher(store, { resolveMedia, player, onUnresolved });
    try {
      store.pendingPlayMedia = command();
      await nextTick();
      await nextTick();

      expect(player.setCurrent).not.toHaveBeenCalled();
      expect(player.play).not.toHaveBeenCalled();
      expect(onUnresolved).toHaveBeenCalledWith(command());
      expect(store.pendingPlayMedia).toEqual(command()); // NOT consumed
    } finally {
      unwatch();
    }
  });

  it('leaves the command unconsumed and notifies onUnresolved when resolution throws', async () => {
    const store = fakeStore();
    const player = fakePlayer();
    const onUnresolved = vi.fn();
    const resolveMedia = vi.fn(async () => {
      throw new Error('fetch failed');
    });
    const unwatch = wirePendingPlayMediaDispatcher(store, { resolveMedia, player, onUnresolved });
    try {
      store.pendingPlayMedia = command();
      await nextTick();
      await nextTick();

      expect(onUnresolved).toHaveBeenCalledWith(command());
      expect(store.pendingPlayMedia).toEqual(command());
    } finally {
      unwatch();
    }
  });

  it('drops a STALE resolution when a newer command replaced the one being resolved', async () => {
    const store = fakeStore();
    const player = fakePlayer();
    // One resolver per command so the test can settle the FIRST (stale) one
    // independently of the second (current) one.
    const resolvers = new Map<string, (item: unknown) => void>();
    const resolveMedia = vi.fn(
      ({ mediaId }: { mediaId: string }) =>
        new Promise((r) => {
          resolvers.set(mediaId, r);
        }),
    );
    const unwatch = wirePendingPlayMediaDispatcher(store, { resolveMedia, player });
    try {
      store.pendingPlayMedia = command({ mediaId: 'media-9' });
      await nextTick();
      // A newer command replaces the pending one while resolution is in flight.
      store.pendingPlayMedia = command({ mediaId: 'media-10', title: 'Tenet' });
      await nextTick();
      resolvers.get('media-9')?.({ id: 'media-9', name: 'Inception' });
      await nextTick();
      await nextTick();

      // The stale media-9 result must NOT load; the newer command stays pending.
      expect(player.setCurrent).not.toHaveBeenCalled();
      expect(player.play).not.toHaveBeenCalled();
      expect(store.pendingPlayMedia).toEqual(command({ mediaId: 'media-10', title: 'Tenet' }));
    } finally {
      unwatch();
    }
  });

  it('does nothing when the slot is cleared', async () => {
    const store = fakeStore();
    const player = fakePlayer();
    const resolveMedia = vi.fn(async () => ({ id: 'media-9' }));
    const unwatch = wirePendingPlayMediaDispatcher(store, { resolveMedia, player });
    try {
      store.pendingPlayMedia = null;
      await nextTick();
      expect(resolveMedia).not.toHaveBeenCalled();
      expect(player.setCurrent).not.toHaveBeenCalled();
    } finally {
      unwatch();
    }
  });
});