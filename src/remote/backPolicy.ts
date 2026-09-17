/**
 * backPolicy — the BACK-key ladder for the TV (S526 / AD-10).
 *
 * On a phone BACK is one thing: "go where you came from". On a TV it is FOUR,
 * in a strict order, because a viewer pressing BACK usually means the NEAREST
 * thing on screen that can absorb the press:
 *
 *   1. `row-snap`    — focus sits inside a horizontally-scrolled shelf. The
 *      FIRST BACK snaps that row back to its start (and item 0) instead of
 *      leaving the page the viewer was still reading.
 *   2. `modal-close` — a closable layer is up (the quality flyout today; any
 *      registered `BackLayer` tomorrow). The TOPMOST layer closes; nothing
 *      underneath it moves.
 *   3. `history-back`— neither of the above: walk the router history toward
 *      home ("back-walks-home").
 *   4. `exit-app`    — already at the app root with nothing above it: BACK
 *      EXITS the app explicitly instead of poking `history.back()` against an
 *      empty stack (the zombie-webview class: the webview sits there having
 *      done nothing, panel awake, app unaddressable).
 *
 * The whole module is PURE — the rung decision is data in / data out, the row
 * probe walks a structural node shape, and the focus memory is a plain LIFO
 * factory. Every DOM/platform touch lives in the caller (`tizenBridge.ts`),
 * behind injectable seams, so a jsdom unit test drives real element shapes
 * without any `tizen.*` object existing. This is deliberate: AD-9 (the
 * @phlix/ui `PhlixApp.vue`/`useSpatialNav.ts` focus-memory leg) will adopt
 * this same ladder + `createLayerFocusStack` — AD-10 BEFORE AD-9 means the
 * policy is written so the ui seam can import the shape, not re-derive it.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

/** The four rungs of the ladder, in decision order. */
export type BackRung = 'row-snap' | 'modal-close' | 'history-back' | 'exit-app';

/**
 * A closable on-screen layer the ladder may consume a BACK for. `id` is for
 * diagnostics/pins; `isOpen` reads current state at press time; `close()`
 * closes EXACTLY this layer (never cascades). Hosts keep the list ordered
 * TOPMOST FIRST — the ladder closes the first open entry and stops.
 */
export interface BackLayer {
  id: string;
  isOpen(): boolean;
  close(): void;
}

/** The minimal route shape the ladder reads (vue-router's route structurally). */
export interface BackRoute {
  name?: string | symbol | null;
  path?: string;
}

/** The app root as this client defines it: the browse shelf at the router base. */
export const APP_ROOT_ROUTE_NAME = 'browse';
export const APP_ROOT_PATH = '/app';

/** True only at the app root — name AND path must agree, or BACK keeps walking. */
export function isAppRootRoute(route: BackRoute): boolean {
  return route.name === APP_ROOT_ROUTE_NAME && route.path === APP_ROOT_PATH;
}

/** Which layers are currently open, in the host's topmost-first order. */
export function openBackLayers(layers: readonly BackLayer[]): BackLayer[] {
  return layers.filter((layer) => layer.isOpen());
}

/** Everything the rung decision reads, as plain data. */
export interface BackSnapshot {
  /** Focus sits inside a horizontally-scrolled row that is NOT at its start. */
  rowScrolled: boolean;
  /** Currently-open closable layers, topmost first. */
  openLayers: readonly BackLayer[];
  /** The route is the app root (see `isAppRootRoute`). */
  atAppRoot: boolean;
}

/**
 * The ladder as a pure function: same snapshot → same rung, every time.
 * Order is the law: row-snap before modal-close before root-exit.
 */
export function decideBackRung(snapshot: BackSnapshot): BackRung {
  if (snapshot.rowScrolled) return 'row-snap';
  if (snapshot.openLayers.length > 0) return 'modal-close';
  if (snapshot.atAppRoot) return 'exit-app';
  return 'history-back';
}

/** The scroll geometry a shelf exposes (satisfied by `HTMLElement`). */
export interface RowGeometry {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

/** The structural node shape the ancestor walk needs (satisfied by `Element`). */
export interface RowNode extends RowGeometry {
  parentElement: RowNode | null;
}

/**
 * A row is "scrolled" when it genuinely overflows horizontally AND has been
 * panned off its start. Zero-geometry hosts (jsdom defaults) are NEVER
 * scrolled — so an un-injected probe on a test DOM cannot mis-fire the rung.
 */
export function isRowScrolled(row: RowGeometry): boolean {
  return row.scrollWidth > row.clientWidth && row.scrollLeft > 0;
}

/**
 * Walk up from the focused node (inclusive) to the first horizontally-scrolled
 * ancestor row — or `null` when focus is not panning one.
 */
export function findScrolledRow(start: RowNode | null): RowNode | null {
  let node = start;
  while (node !== null) {
    if (isRowScrolled(node)) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * LIFO focus memory that rides the layer stack: `push` what held focus BEFORE
 * a layer opened, `pop` it when that layer closes, `clear` on teardown. Pure
 * over an opaque node type `T`, so both this repo (DOM elements) and the AD-9
 * ui seam (focus keys) can share the shape.
 */
export interface LayerFocusStack<T> {
  push(node: T): void;
  pop(): T | null;
  depth(): number;
  clear(): void;
}

export function createLayerFocusStack<T>(): LayerFocusStack<T> {
  const stack: T[] = [];
  return {
    push: (node: T): void => {
      stack.push(node);
    },
    pop: (): T | null => (stack.length > 0 ? (stack.pop() as T) : null),
    depth: (): number => stack.length,
    clear: (): void => {
      stack.length = 0;
    }
  };
}
