import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  wireTizenBridge,
  createDomQualityMenu,
  installTizenBridge,
  qualityMenuActive,
  type BridgePlayer,
  type BridgeRouter,
  type BridgeRemote,
  type BridgeRoute,
  type BridgeQualityMenu
} from '@/tizenBridge';
import remoteManager from '@/remote/RemoteManager';
import type { ActionEvent } from '@/remote/RemoteManager';
import type { App as VueApp } from 'vue';

// usePlayerStore is only touched by installTizenBridge, not the pure helper;
// stub it so importing the module is safe under jsdom.
vi.mock('@phlix/ui', () => ({
  usePlayerStore: vi.fn(() => ({}))
}));

// MutationObserver callbacks fire on a microtask; a macrotask tick reliably
// flushes jsdom's delivery so assertions see the observed teardown.
const flushMutations = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

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

function makeQuality(
  opts: { available?: boolean; active?: boolean } = {}
): BridgeQualityMenu & {
  activate: ReturnType<typeof vi.fn>;
  deactivate: ReturnType<typeof vi.fn>;
} {
  let active = opts.active ?? false;
  return {
    isAvailable: vi.fn(() => opts.available ?? true),
    isActive: vi.fn(() => active),
    activate: vi.fn(() => {
      active = true;
    }),
    deactivate: vi.fn(() => {
      active = false;
    })
  };
}

const browseRoute = (): BridgeRoute => ({ name: 'home' });
const playerRoute = (): BridgeRoute => ({ name: 'player' });

describe('wireTizenBridge', () => {
  let remote: FakeRemote;

  beforeEach(() => {
    remote = makeRemote();
    qualityMenuActive.value = false;
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

  it('YELLOW opens the QualityMenu on the player route when available', () => {
    const quality = makeQuality({ available: true });
    wireTizenBridge(remote, makePlayer(), makeRouter(), playerRoute, quality);
    remote.fire({ key: 'YELLOW' });
    expect(quality.activate).toHaveBeenCalledTimes(1);
  });

  it('YELLOW is a no-op off the player route', () => {
    const quality = makeQuality({ available: true });
    wireTizenBridge(remote, makePlayer(), makeRouter(), browseRoute, quality);
    remote.fire({ key: 'YELLOW' });
    expect(quality.activate).not.toHaveBeenCalled();
  });

  it('YELLOW is a no-op when the QualityMenu is not on screen', () => {
    const quality = makeQuality({ available: false });
    wireTizenBridge(remote, makePlayer(), makeRouter(), playerRoute, quality);
    remote.fire({ key: 'YELLOW' });
    expect(quality.activate).not.toHaveBeenCalled();
  });

  it('YELLOW toggles the QualityMenu closed when it is already active', () => {
    const quality = makeQuality({ available: true, active: true });
    wireTizenBridge(remote, makePlayer(), makeRouter(), playerRoute, quality);
    remote.fire({ key: 'YELLOW' });
    expect(quality.deactivate).toHaveBeenCalledTimes(1);
    expect(quality.activate).not.toHaveBeenCalled();
  });

  it('BACK dismisses an active QualityMenu without leaving the player', () => {
    const quality = makeQuality({ active: true });
    const player = makePlayer(true);
    const router = makeRouter();
    wireTizenBridge(remote, player, router, playerRoute, quality);
    remote.fire({ key: 'BACK' });
    expect(quality.deactivate).toHaveBeenCalledTimes(1);
    expect(player.closePlayer).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('BACK still closes the player when the QualityMenu is inactive', () => {
    const quality = makeQuality({ active: false });
    const player = makePlayer(true);
    const router = makeRouter();
    wireTizenBridge(remote, player, router, playerRoute, quality);
    remote.fire({ key: 'BACK' });
    expect(quality.deactivate).not.toHaveBeenCalled();
    expect(player.closePlayer).toHaveBeenCalledTimes(1);
    expect(router.back).toHaveBeenCalledTimes(1);
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

describe('createDomQualityMenu (DOM-backed QualityMenu controller)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    qualityMenuActive.value = false;
  });

  function addTrigger(expanded = false): HTMLButtonElement {
    document.body.innerHTML =
      `<div class="quality-menu phlix-select">` +
      `<button class="phlix-select__trigger" aria-expanded="${expanded}"></button></div>`;
    return document.querySelector<HTMLButtonElement>('.quality-menu .phlix-select__trigger')!;
  }

  it('isAvailable reflects whether the QualityMenu trigger is on screen', () => {
    const q = createDomQualityMenu();
    expect(q.isAvailable()).toBe(false);
    addTrigger();
    expect(q.isAvailable()).toBe(true);
  });

  it('activate focuses + opens a collapsed menu and flips the shared flag', () => {
    const trigger = addTrigger(false);
    const focus = vi.spyOn(trigger, 'focus');
    const click = vi.spyOn(trigger, 'click');
    const q = createDomQualityMenu();
    q.activate();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1); // opened (was collapsed)
    expect(q.isActive()).toBe(true);
    expect(qualityMenuActive.value).toBe(true);
  });

  it('activate does not re-open an already-open menu', () => {
    const trigger = addTrigger(true);
    const click = vi.spyOn(trigger, 'click');
    createDomQualityMenu().activate();
    expect(click).not.toHaveBeenCalled();
  });

  it('activate is a no-op (stays inactive) when no menu is present', () => {
    const q = createDomQualityMenu();
    q.activate();
    expect(q.isActive()).toBe(false);
    expect(qualityMenuActive.value).toBe(false);
  });

  it('deactivate closes an open menu, blurs the trigger, and clears the flag', () => {
    const trigger = addTrigger(true);
    const click = vi.spyOn(trigger, 'click');
    const blur = vi.spyOn(trigger, 'blur');
    const q = createDomQualityMenu();
    q.activate(); // menu already open → no click here
    q.deactivate();
    expect(click).toHaveBeenCalledTimes(1); // toggled closed
    expect(blur).toHaveBeenCalledTimes(1);
    expect(q.isActive()).toBe(false);
    expect(qualityMenuActive.value).toBe(false);
  });

  it('uses an injectable state ref so callers can observe activity', () => {
    const trigger = addTrigger(false);
    vi.spyOn(trigger, 'focus');
    vi.spyOn(trigger, 'click');
    const q = createDomQualityMenu(qualityMenuActive);
    q.activate();
    expect(qualityMenuActive.value).toBe(true);
  });

  it('clears the shared flag when the Select closes ITSELF (ENTER selects a rung)', async () => {
    // Open menu (aria-expanded already true → activate attaches the observer
    // without re-clicking). Selecting a rung makes @phlix/ui's Select collapse
    // its own listbox (aria-expanded → false) — no BACK/YELLOW involved.
    const trigger = addTrigger(true);
    const q = createDomQualityMenu();
    q.activate();
    expect(qualityMenuActive.value).toBe(true);

    trigger.setAttribute('aria-expanded', 'false'); // Select closed on rung-select
    await flushMutations();

    expect(qualityMenuActive.value).toBe(false);
    expect(q.isActive()).toBe(false);
  });

  it('also clears the flag when the Select closes via Escape / outside click', async () => {
    const trigger = addTrigger(true);
    const q = createDomQualityMenu();
    q.activate();
    expect(qualityMenuActive.value).toBe(true);

    // Any non-'true' aria-expanded value counts as closed.
    trigger.removeAttribute('aria-expanded');
    await flushMutations();

    expect(qualityMenuActive.value).toBe(false);
  });

  it('a stale observer does not clear a freshly re-activated menu', async () => {
    addTrigger(true);
    const q = createDomQualityMenu();
    q.activate();
    q.deactivate(); // disconnects the observer + clears the flag
    q.activate(); // fresh observer for the new session
    expect(qualityMenuActive.value).toBe(true);
    await flushMutations();
    // The re-activation left the menu open; no spurious teardown fired.
    expect(qualityMenuActive.value).toBe(true);
  });
});

describe('installTizenBridge (composed lifecycle teardown)', () => {
  interface RouteGuardSink {
    guard?: (to: BridgeRoute) => void;
    remove: ReturnType<typeof vi.fn>;
  }

  function makeApp(routeName: string, sink: RouteGuardSink): VueApp {
    return {
      config: {
        globalProperties: {
          $pinia: {},
          $router: {
            push: vi.fn(),
            back: vi.fn(),
            currentRoute: { value: { name: routeName } as BridgeRoute },
            afterEach: (guard: (to: BridgeRoute) => void) => {
              sink.guard = guard;
              return sink.remove;
            }
          }
        }
      }
    } as unknown as VueApp;
  }

  let cleanup: (() => void) | null = null;

  beforeEach(() => {
    document.body.innerHTML = '';
    qualityMenuActive.value = false;
  });

  afterEach(() => {
    cleanup?.();
    cleanup = null;
    remoteManager.suppressPropagation = null;
  });

  it('tears down quality mode when navigation LEAVES the player route (HOME/STOP)', () => {
    const sink: RouteGuardSink = { remove: vi.fn() };
    cleanup = installTizenBridge(makeApp('player', sink));
    qualityMenuActive.value = true; // menu open on the player

    expect(sink.guard).toBeTypeOf('function');
    sink.guard!({ name: 'home' }); // e.g. HOME pushed '/app'

    expect(qualityMenuActive.value).toBe(false);
  });

  it('does NOT tear down quality mode on same-route (player→player) navigation', () => {
    const sink: RouteGuardSink = { remove: vi.fn() };
    cleanup = installTizenBridge(makeApp('player', sink));
    qualityMenuActive.value = true;

    sink.guard!({ name: 'player' });

    expect(qualityMenuActive.value).toBe(true);
  });

  it('cleanup nulls the suppression guard, removes the route guard, and clears the flag', () => {
    const sink: RouteGuardSink = { remove: vi.fn() };
    const teardown = installTizenBridge(makeApp('player', sink));
    expect(remoteManager.suppressPropagation).toBeTypeOf('function');
    qualityMenuActive.value = true; // menu still open when the bridge is torn down

    teardown();
    cleanup = null; // already torn down

    expect(remoteManager.suppressPropagation).toBeNull();
    expect(sink.remove).toHaveBeenCalledTimes(1);
    expect(qualityMenuActive.value).toBe(false);
  });

  it('the wired suppressPropagation stops ONLY the D-pad nav keys, and only while quality mode is active', () => {
    const sink: RouteGuardSink = { remove: vi.fn() };
    cleanup = installTizenBridge(makeApp('player', sink));
    const guard = remoteManager.suppressPropagation;
    expect(guard).toBeTypeOf('function');
    const ev = {} as KeyboardEvent; // the real predicate ignores the event arg

    // Inactive: nothing is suppressed — the player keeps its Arrow seek/volume.
    qualityMenuActive.value = false;
    for (const key of ['LEFT', 'RIGHT', 'UP', 'DOWN', 'PLAY', 'YELLOW', 'ENTER', 'BACK']) {
      expect(guard!(key, ev)).toBe(false);
    }

    // Active: the four D-pad nav keys are suppressed so the focused Select owns them.
    qualityMenuActive.value = true;
    for (const key of ['LEFT', 'RIGHT', 'UP', 'DOWN']) {
      expect(guard!(key, ev)).toBe(true);
    }
    // ...but transport / ENTER / BACK / color keys still pass through even when active
    // (ENTER must reach the Select to confirm a rung; BACK/YELLOW dismiss the menu).
    for (const key of [
      'PLAY',
      'PLAY_PAUSE',
      'PAUSE',
      'STOP',
      'FAST_FORWARD',
      'REWIND',
      'YELLOW',
      'ENTER',
      'BACK',
      'HOME'
    ]) {
      expect(guard!(key, ev)).toBe(false);
    }
  });

  it('degrades gracefully against a router with no afterEach (no throw; cleanup is a no-op guard-wise)', () => {
    // Older / fake routers may not expose afterEach. installTizenBridge must not
    // throw at install OR teardown, and must still wire suppression + the bridge.
    const app = {
      config: {
        globalProperties: {
          $pinia: {},
          $router: {
            push: vi.fn(),
            back: vi.fn(),
            currentRoute: { value: { name: 'player' } as BridgeRoute }
            // no afterEach
          }
        }
      }
    } as unknown as VueApp;

    let teardown: (() => void) | undefined;
    expect(() => {
      teardown = installTizenBridge(app);
    }).not.toThrow();
    expect(remoteManager.suppressPropagation).toBeTypeOf('function');

    qualityMenuActive.value = true;
    expect(() => teardown!()).not.toThrow();
    // Teardown still clears the shared flag + suppression even with no route guard.
    expect(qualityMenuActive.value).toBe(false);
    expect(remoteManager.suppressPropagation).toBeNull();
  });
});
