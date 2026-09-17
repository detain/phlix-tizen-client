/**
 * backPolicy.test — S526 AD-10 BACK-ladder pins (pure module, zero DOM).
 *
 * AC-2 "unit-pinned per rung": the decision table is exhaustively pinned —
 * row-snap beats modal-close beats history-back beats exit-app, and every
 * rung-fallthrough combination is named, so a reorder cannot silently ship.
 * Plus the shelf ancestor walk over fake node chains (jsdom never sees a
 * `tizen.*` call: the whole module is data in / data out).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, vi } from 'vitest';
import {
  APP_ROOT_PATH,
  APP_ROOT_ROUTE_NAME,
  createLayerFocusStack,
  decideBackRung,
  findScrolledRow,
  isAppRootRoute,
  isRowScrolled,
  openBackLayers,
  type BackLayer,
  type RowNode
} from '@/remote/backPolicy';

function layer(id: string, open: boolean): BackLayer {
  return { id, isOpen: () => open, close: vi.fn() };
}

function row(partial: Partial<RowNode> & { parentElement?: RowNode | null } = {}): RowNode {
  return {
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
    parentElement: null,
    ...partial
  };
}

describe('decideBackRung — the ladder order is the law', () => {
  const closed: readonly BackLayer[] = [];

  it('row-snap outranks everything: a panned shelf absorbs the press', () => {
    expect(
      decideBackRung({ rowScrolled: true, openLayers: [layer('modal', true)], atAppRoot: true })
    ).toBe('row-snap');
  });

  it('modal-close outranks history and exit', () => {
    expect(
      decideBackRung({ rowScrolled: false, openLayers: [layer('quality-menu', true)], atAppRoot: true })
    ).toBe('modal-close');
  });

  it('at the app root with nothing above it, BACK EXITS (no history poke at the floor)', () => {
    expect(decideBackRung({ rowScrolled: false, openLayers: closed, atAppRoot: true })).toBe('exit-app');
  });

  it('otherwise BACK walks history toward home', () => {
    expect(decideBackRung({ rowScrolled: false, openLayers: closed, atAppRoot: false })).toBe(
      'history-back'
    );
  });

  it('an OPEN-LAYERS LIST of closed layers is not a layer: decision falls through', () => {
    // decideBackRung reads the ALREADY-FILTERED list; openBackLayers is the
    // filter — this pins the pair composes honestly.
    const all = [layer('a', false), layer('b', false)];
    expect(openBackLayers(all)).toEqual([]);
    expect(decideBackRung({ rowScrolled: false, openLayers: openBackLayers(all), atAppRoot: false })).toBe(
      'history-back'
    );
  });

  it('is PURE: the same snapshot gives the same rung every time', () => {
    const snapshot = { rowScrolled: false, openLayers: [layer('m', true)], atAppRoot: false };
    expect(decideBackRung(snapshot)).toBe(decideBackRung(snapshot));
  });
});

describe('openBackLayers — topmost-first order is preserved', () => {
  it('keeps only open layers, in the host order', () => {
    const layers = [layer('host-modal', false), layer('ui-focus-trap', true), layer('quality-menu', true)];
    expect(openBackLayers(layers).map((l) => l.id)).toEqual(['ui-focus-trap', 'quality-menu']);
  });

  it('the ladder closes the FIRST open entry — never a cascade', () => {
    const top = layer('top', true);
    const bottom = layer('bottom', true);
    const open = openBackLayers([top, bottom]);
    open[0]?.close();
    expect(top.close).toHaveBeenCalledTimes(1);
    expect(bottom.close).not.toHaveBeenCalled();
  });
});

describe('isAppRootRoute — name AND path must agree', () => {
  it('the browse shelf at the router base is the root', () => {
    expect(isAppRootRoute({ name: APP_ROOT_ROUTE_NAME, path: APP_ROOT_PATH })).toBe(true);
  });

  it('a browse route at a deeper path is NOT the floor', () => {
    expect(isAppRootRoute({ name: 'browse', path: '/app/library/1' })).toBe(false);
  });

  it('the player, login, or a route-less fake never reads as root', () => {
    expect(isAppRootRoute({ name: 'player', path: '/app/media/9' })).toBe(false);
    expect(isAppRootRoute({ name: 'login', path: '/app/login' })).toBe(false);
    expect(isAppRootRoute({})).toBe(false);
    expect(isAppRootRoute({ name: 'home' })).toBe(false);
  });
});

describe('isRowScrolled / findScrolledRow — the shelf probe', () => {
  it('a row is scrolled only when it overflows AND is panned off zero', () => {
    expect(isRowScrolled(row({ scrollWidth: 2000, clientWidth: 800, scrollLeft: 10 }))).toBe(true);
    expect(isRowScrolled(row({ scrollWidth: 2000, clientWidth: 800, scrollLeft: 0 }))).toBe(false);
    expect(isRowScrolled(row({ scrollWidth: 800, clientWidth: 800, scrollLeft: 40 }))).toBe(false);
  });

  it('jsdom-default zero geometry is NEVER "scrolled" (no mis-fire on a test DOM)', () => {
    expect(isRowScrolled(row())).toBe(false);
  });

  it('walks up from the focused node (inclusive) to the first scrolled ancestor', () => {
    const shelf = row({ scrollWidth: 3000, clientWidth: 1000, scrollLeft: 250 });
    const poster = row({ parentElement: shelf });
    const page = row({ parentElement: poster });
    // focus is ON the poster; the scroll lives on its ancestor shelf.
    expect(findScrolledRow(poster)).toBe(shelf);
    // focus on the shelf itself still counts.
    expect(findScrolledRow(shelf)).toBe(shelf);
    // focus a level higher keeps walking the same chain to the scrolled shelf.
    expect(findScrolledRow(page)).toBe(shelf);
  });

  it('returns null at the top of an unscrolled chain, and for a null start', () => {
    const plain = row();
    expect(findScrolledRow(plain)).toBeNull();
    expect(findScrolledRow(null)).toBeNull();
  });
});

describe('createLayerFocusStack — the LIFO focus memory AD-9 adopts', () => {
  it('pushes on layer-open and pops topmost-first on layer-close', () => {
    const stack = createLayerFocusStack<string>();
    stack.push('poster-row-2');
    stack.push('quality-flyout');
    expect(stack.depth()).toBe(2);
    expect(stack.pop()).toBe('quality-flyout');
    expect(stack.pop()).toBe('poster-row-2');
  });

  it('popping an empty stack is null, not a throw (fail-soft by shape)', () => {
    const stack = createLayerFocusStack<string>();
    expect(stack.pop()).toBeNull();
    expect(stack.depth()).toBe(0);
  });

  it('clear() wipes the memory (teardown never strands a stale node)', () => {
    const stack = createLayerFocusStack<string>();
    stack.push('a');
    stack.push('b');
    stack.clear();
    expect(stack.depth()).toBe(0);
    expect(stack.pop()).toBeNull();
  });
});
