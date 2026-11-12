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

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { reactive, nextTick } from 'vue';
import {
  wirePendingPlayMediaDispatcher,
  isPendingCommandStale,
  PENDING_COMMAND_MAX_SKEW_S,
  type PendingPlayMediaStore,
  type PendingPlayMediaPlayer,
} from '@/syncplayDispatch';
import type { PendingPlayMediaCommand } from '@/api/hubRelay';
import type { MediaItem } from '@phlix/ui';

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

function fakePlayer(): PendingPlayMediaPlayer & {
  setCurrent: Mock<(media: MediaItem, opts?: { resetPosition?: boolean; streamUrl?: string }) => void>;
  play: Mock<() => void>;
} {
  return {
    setCurrent: vi.fn<(media: MediaItem, opts?: { resetPosition?: boolean; streamUrl?: string }) => void>(),
    play: vi.fn<() => void>(),
  };
}

/** The fixture's `issuedAt` (Unix s) — the pinned "now" of every test below,
 *  so the TIZ-17 staleness guard sees a fresh command unless a test moves it. */
const ISSUED_AT_S = 1_700_000_000;

beforeEach(() => {
  vi.clearAllMocks();
  // Only Date is faked: vue's nextTick (promise microtasks) must stay real.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(ISSUED_AT_S * 1000);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('wirePendingPlayMediaDispatcher — the load-a-new-title path', () => {
  it('loads the resolved title: setCurrent + play + consume', async () => {
    const store = fakeStore();
    const player = fakePlayer();
    const item = { id: 'media-9', name: 'Inception', type: 'movie' } as MediaItem;
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
    const resolvers = new Map<string, (item: MediaItem) => void>();
    const resolveMedia = vi.fn(
      ({ mediaId }: { mediaId: string }) =>
        new Promise<MediaItem>((r) => {
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
      resolvers.get('media-9')?.({ id: 'media-9', name: 'Inception' } as MediaItem);
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
    const resolveMedia = vi.fn(async () => ({ id: 'media-9' }) as MediaItem);
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

// ── TIZ-17 — issuedAt staleness guard (generous, symmetric: TV clocks drift) ──

describe('isPendingCommandStale — the bounded skew window', () => {
  const nowMs = ISSUED_AT_S * 1000;

  it('is generous: the bound is ten minutes either way', () => {
    expect(PENDING_COMMAND_MAX_SKEW_S).toBe(600);
  });

  it('accepts a command anywhere inside the window, edges included', () => {
    expect(isPendingCommandStale(ISSUED_AT_S, nowMs)).toBe(false);
    expect(isPendingCommandStale(ISSUED_AT_S - 600, nowMs)).toBe(false);
    expect(isPendingCommandStale(ISSUED_AT_S + 600, nowMs)).toBe(false);
  });

  it('rejects a command older than the window', () => {
    expect(isPendingCommandStale(ISSUED_AT_S - 601, nowMs)).toBe(true);
  });

  it('rejects a command dated further in the future than the window (unit error / broken clock)', () => {
    expect(isPendingCommandStale(ISSUED_AT_S + 601, nowMs)).toBe(true);
    // A milliseconds-for-seconds unit slip lands far in the future.
    expect(isPendingCommandStale(ISSUED_AT_S * 1000, nowMs)).toBe(true);
  });

  it('honors an explicit bound', () => {
    expect(isPendingCommandStale(ISSUED_AT_S - 31, nowMs, 30)).toBe(true);
    expect(isPendingCommandStale(ISSUED_AT_S - 30, nowMs, 30)).toBe(false);
  });
});

describe('wirePendingPlayMediaDispatcher — stale-frame rejection (TIZ-17)', () => {
  it('drops a stale command: no resolve, no playback, slot consumed, onStale notified', async () => {
    const store = fakeStore();
    const player = fakePlayer();
    const onStale = vi.fn();
    const onUnresolved = vi.fn();
    const resolveMedia = vi.fn(async () => ({ id: 'media-9' }) as MediaItem);
    const unwatch = wirePendingPlayMediaDispatcher(store, { resolveMedia, player, onStale, onUnresolved });
    try {
      const stale = command({ issuedAt: ISSUED_AT_S - PENDING_COMMAND_MAX_SKEW_S - 1 });
      store.pendingPlayMedia = stale;
      await nextTick();
      await nextTick();

      expect(resolveMedia).not.toHaveBeenCalled();
      expect(player.setCurrent).not.toHaveBeenCalled();
      expect(player.play).not.toHaveBeenCalled();
      expect(store.consumePendingPlayMedia).toHaveBeenCalledTimes(1);
      expect(store.pendingPlayMedia).toBeNull(); // can never start later
      expect(onStale).toHaveBeenCalledWith(stale);
      expect(onUnresolved).not.toHaveBeenCalled();
    } finally {
      unwatch();
    }
  });

  it('drops a command dated beyond the window in the future', async () => {
    const store = fakeStore();
    const player = fakePlayer();
    const resolveMedia = vi.fn(async () => ({ id: 'media-9' }) as MediaItem);
    const unwatch = wirePendingPlayMediaDispatcher(store, { resolveMedia, player });
    try {
      store.pendingPlayMedia = command({ issuedAt: ISSUED_AT_S + PENDING_COMMAND_MAX_SKEW_S + 1 });
      await nextTick();
      await nextTick();

      expect(resolveMedia).not.toHaveBeenCalled();
      expect(player.play).not.toHaveBeenCalled();
      expect(store.pendingPlayMedia).toBeNull();
    } finally {
      unwatch();
    }
  });

  it('still plays a command from a drifted-but-sane clock (inside the window)', async () => {
    const store = fakeStore();
    const player = fakePlayer();
    const item = { id: 'media-9', name: 'Inception', type: 'movie' } as MediaItem;
    const resolveMedia = vi.fn(async () => item);
    const onStale = vi.fn();
    const unwatch = wirePendingPlayMediaDispatcher(store, { resolveMedia, player, onStale });
    try {
      store.pendingPlayMedia = command({ issuedAt: ISSUED_AT_S - 9 * 60 }); // 9 min behind
      await nextTick();
      await nextTick();

      expect(onStale).not.toHaveBeenCalled();
      expect(player.setCurrent).toHaveBeenCalledWith(item, { resetPosition: true });
      expect(player.play).toHaveBeenCalledTimes(1);
    } finally {
      unwatch();
    }
  });

  it('reads the injected clock seam instead of Date.now', async () => {
    const store = fakeStore();
    const player = fakePlayer();
    const resolveMedia = vi.fn(async () => ({ id: 'media-9' }) as MediaItem);
    const onStale = vi.fn();
    // System time says fresh; the seam says an hour later — the seam wins.
    const now = vi.fn(() => (ISSUED_AT_S + 3600) * 1000);
    const unwatch = wirePendingPlayMediaDispatcher(store, { resolveMedia, player, onStale, now });
    try {
      store.pendingPlayMedia = command();
      await nextTick();
      await nextTick();

      expect(now).toHaveBeenCalled();
      expect(onStale).toHaveBeenCalledWith(command());
      expect(resolveMedia).not.toHaveBeenCalled();
    } finally {
      unwatch();
    }
  });
});
