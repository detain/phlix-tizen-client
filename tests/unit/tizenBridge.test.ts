import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  wireTizenBridge,
  type BridgePlayer,
  type BridgeRouter,
  type BridgeRemote,
  type BridgeRoute
} from '@/tizenBridge';
import type { ActionEvent } from '@/remote/RemoteManager';

// usePlayerStore is only touched by installTizenBridge, not the pure helper;
// stub it so importing the module is safe under jsdom.
vi.mock('@phlix/ui', () => ({
  usePlayerStore: vi.fn(() => ({}))
}));

interface FakeRemote extends BridgeRemote {
  fire: (action: ActionEvent) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
}

function makeRemote(): FakeRemote {
  let handler: ((data: ActionEvent) => void) | null = null;
  const unsubscribe = vi.fn(() => {
    handler = null;
  });
  const off = vi.fn();
  return {
    on: vi.fn((_event: string, cb: (data: ActionEvent) => void) => {
      handler = cb;
      return unsubscribe;
    }),
    off,
    fire: (action: ActionEvent) => {
      if (handler) handler(action);
    },
    unsubscribe
  };
}

function makePlayer(playing = false): BridgePlayer & {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  closePlayer: ReturnType<typeof vi.fn>;
  seekBy: ReturnType<typeof vi.fn>;
} {
  return {
    playing,
    play: vi.fn(),
    pause: vi.fn(),
    closePlayer: vi.fn(),
    seekBy: vi.fn()
  };
}

function makeRouter(): BridgeRouter & {
  push: ReturnType<typeof vi.fn>;
  back: ReturnType<typeof vi.fn>;
} {
  return { push: vi.fn(), back: vi.fn() };
}

const browseRoute = (): BridgeRoute => ({ name: 'home' });
const playerRoute = (): BridgeRoute => ({ name: 'player' });

describe('wireTizenBridge', () => {
  let remote: FakeRemote;

  beforeEach(() => {
    remote = makeRemote();
  });

  it('returns a no-op when the remote is missing', () => {
    const player = makePlayer();
    const router = makeRouter();
    const cleanup = wireTizenBridge(null, player, router, browseRoute);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  it('PLAY toggles play when paused', () => {
    const player = makePlayer(false);
    wireTizenBridge(remote, player, makeRouter(), browseRoute);
    remote.fire({ key: 'PLAY' });
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(player.pause).not.toHaveBeenCalled();
  });

  it('PLAY toggles pause when playing', () => {
    const player = makePlayer(true);
    wireTizenBridge(remote, player, makeRouter(), browseRoute);
    remote.fire({ key: 'PLAY' });
    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.play).not.toHaveBeenCalled();
  });

  it('PLAY_PAUSE toggles like PLAY', () => {
    const player = makePlayer(false);
    wireTizenBridge(remote, player, makeRouter(), browseRoute);
    remote.fire({ key: 'PLAY_PAUSE' });
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('PAUSE pauses the player', () => {
    const player = makePlayer(true);
    wireTizenBridge(remote, player, makeRouter(), browseRoute);
    remote.fire({ key: 'PAUSE' });
    expect(player.pause).toHaveBeenCalledTimes(1);
  });

  it('STOP closes the player', () => {
    const player = makePlayer(true);
    wireTizenBridge(remote, player, makeRouter(), browseRoute);
    remote.fire({ key: 'STOP' });
    expect(player.closePlayer).toHaveBeenCalledTimes(1);
  });

  it('FAST_FORWARD seeks +10 on tap and +30 when held', () => {
    const player = makePlayer(true);
    wireTizenBridge(remote, player, makeRouter(), browseRoute);
    remote.fire({ key: 'FAST_FORWARD' });
    expect(player.seekBy).toHaveBeenNthCalledWith(1, 10);
    remote.fire({ key: 'FAST_FORWARD', repeat: true });
    expect(player.seekBy).toHaveBeenNthCalledWith(2, 30);
  });

  it('REWIND seeks -10 on tap and -30 when held', () => {
    const player = makePlayer(true);
    wireTizenBridge(remote, player, makeRouter(), browseRoute);
    remote.fire({ key: 'REWIND' });
    expect(player.seekBy).toHaveBeenNthCalledWith(1, -10);
    remote.fire({ key: 'REWIND', repeat: true });
    expect(player.seekBy).toHaveBeenNthCalledWith(2, -30);
  });

  it('BACK on the player route closes the player and goes back', () => {
    const player = makePlayer(true);
    const router = makeRouter();
    wireTizenBridge(remote, player, router, playerRoute);
    remote.fire({ key: 'BACK' });
    expect(player.closePlayer).toHaveBeenCalledTimes(1);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('BACK off the player route only goes back', () => {
    const player = makePlayer(false);
    const router = makeRouter();
    wireTizenBridge(remote, player, router, browseRoute);
    remote.fire({ key: 'BACK' });
    expect(player.closePlayer).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('HOME pushes the /app route', () => {
    const router = makeRouter();
    wireTizenBridge(remote, makePlayer(), router, browseRoute);
    remote.fire({ key: 'HOME' });
    expect(router.push).toHaveBeenCalledWith('/app');
  });

  it('ignores arrow keys and ENTER (spatial-nav / native focus own them)', () => {
    const player = makePlayer();
    const router = makeRouter();
    wireTizenBridge(remote, player, router, browseRoute);
    for (const key of ['LEFT', 'UP', 'RIGHT', 'DOWN', 'ENTER']) {
      remote.fire({ key });
    }
    expect(player.play).not.toHaveBeenCalled();
    expect(player.pause).not.toHaveBeenCalled();
    expect(player.seekBy).not.toHaveBeenCalled();
    expect(player.closePlayer).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('cleanup unsubscribes from the remote', () => {
    const cleanup = wireTizenBridge(remote, makePlayer(), makeRouter(), browseRoute);
    cleanup();
    expect(remote.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('falls back to remote.off when on() returns no unsubscribe', () => {
    const off = vi.fn();
    let handler: ((data: ActionEvent) => void) | null = null;
    const remoteNoUnsub: BridgeRemote = {
      on: vi.fn((_e: string, cb: (data: ActionEvent) => void) => {
        handler = cb;
      }),
      off
    };
    const cleanup = wireTizenBridge(remoteNoUnsub, makePlayer(), makeRouter(), browseRoute);
    expect(typeof handler).toBe('function');
    cleanup();
    expect(off).toHaveBeenCalledTimes(1);
  });
});
