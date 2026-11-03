/**
 * Keeps @phlix/ui's spatial-navigation candidate registry populated from the
 * live DOM, so the remote D-pad has somewhere to move.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { ref, type Ref } from 'vue';

// @phlix/ui's `useSpatialNav` moves focus between the elements in its exported
// `focusableRegistry` Set. The ONLY producer of entries in the pinned ui tree
// (v0.99.10, dist-only) is the opt-in `v-focusable` directive — which no ui
// template actually uses (grep `data-focusable` across the shipped bundle: zero
// call sites). The registry was therefore provably empty on every surface: the
// engine's key handler found no candidates, never called preventDefault, and
// the D-pad just scrolled the page (C27 / review tizen__gameux, Critical 1).
//
// Rather than fork upstream templates, the TV shell registers candidates at the
// engine boundary: every element matching the SAME interactive shape the ui
// focus trap and the row-snap probe accept (FOCUSABLE_SELECTOR below, formerly
// local to tizenBridge.ts), discovered live under `root` and kept in sync by a
// coalesced MutationObserver. The Tizen focus law: every interactive element
// on screen is reachable via D-pad, including the S520 QuickConnect panel.
//
// Entries the directive itself owns (data-focusable="" — empty string) are
// never touched: shell-owned registrations are marked data-focusable="auto"
// and only THEY are swept. We deliberately do not set tabindex — every node
// the selector admits is already focusable natively; stealing Tab order from
// the desktop/webview build is not this module's prerogative.
//
// C2 (reviews tizen__gameux Critical + tizen__crossfe Minor 2) adds the two
// filter dimensions the raw selector never had:
//  (a) LAYERING — a full-bleed opaque takeover (the QuickConnect pairing
//      panel) does not remove the controls beneath it, so a purely geometric
//      pool kept registering the hidden Connect/Login surface: arrow presses
//      landed invisible focus rings under the panel and ENTER fired unseen
//      actions. Takeovers mark their root with TAKEOVER_ATTRIBUTE; while one
//      is mounted it is the ONLY subtree the pool admits, foreign shell
//      entries are swept, and focus already parked under the new layer is
//      released (blurred — the watcher removes focus, never moves it).
//  (b) VISIBILITY — v-show-hidden (`display:none`), `visibility:hidden` and
//      `hidden` nodes stayed registered until actual removal; spatial nav
//      could focus an off-screen control. A computed-style ancestor walk
//      excludes them at admit AND at every sweep.

/** The attribute marking a subtree as a SPATIAL TAKEOVER. While any element
 * carrying it is mounted, the candidate pool admits ONLY nodes inside it
 * (C2(a)). Set by the surface itself — the QuickConnect panel is today's
 * single producer; the mechanism is generic for future full-bleed layers.
 * The reactive mirror `spatialTakeover` below lets other host surfaces
 * (e.g. the telemetry consent card, M6) yield while a takeover is up. */
export const TAKEOVER_ATTRIBUTE = 'data-spatial-takeover';

/** Reactive mirror of the watcher's active takeover — maintained SOLELY by
 * createFocusCandidateWatcher (single-writer in production: one watcher per
 * app boot, owned by SpatialNavHost). null = no takeover in effect. Mirrors
 * the established cross-app `qualityMenuActive` pattern from tizenBridge.ts:
 * a module-level ref shared by the sibling root apps through import identity. */
export const spatialTakeover: Ref<HTMLElement | null> = ref(null);

/** The focusable shape @phlix/ui's focus trap itself accepts (useFocusTrap.ts) —
 * row-snap "item 0" focuses the first node a spatial stop could ever land on,
 * and the spatial engine's candidate pool is exactly this set. Single source:
 * tizenBridge.ts imports it from here. */
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The data-focusable value marking a registry entry as shell-owned. The ui
 * directive writes data-focusable="" — the two producers never collide. */
export const AUTO_FOCUS_MARKER = 'auto';

/** The attribute both producers stamp; value distinguishes ownership. */
const FOCUSABLE_ATTR = 'data-focusable';

export interface FocusCandidateWatcher {
  /** Synchronous full re-scan of `root` against the registry. */
  refresh(): void;
  /** Disconnect the observer and deregister every shell-owned entry. */
  destroy(): void;
}

/** True only for entries THIS module added (directive/unmarked entries are not). */
function isShellOwnedEntry(element: HTMLElement): boolean {
  return element.getAttribute(FOCUSABLE_ATTR) === AUTO_FOCUS_MARKER;
}

/** Drop one shell-owned entry from the registry and un-stamp its element. */
function releaseShellEntry(element: HTMLElement, registry: Set<HTMLElement>): void {
  registry.delete(element);
  element.removeAttribute(FOCUSABLE_ATTR);
}

/**
 * Watch `root` and keep `registry` holding exactly the currently-interactive
 * elements beneath it. Pure over injected seams: the production host injects
 * `document.body` + ui's `focusableRegistry`; tests inject a scratch subtree
 * and a fresh Set. No focus is ever moved, no request is ever made — the
 * registry is passive data the engine reads on keypress (the engine itself
 * gates on tv mode / route / quality-menu, so populating it app-wide is safe
 * even on surfaces where navigation is off, like the player).
 */
export function createFocusCandidateWatcher(options: {
  root: Element;
  registry: Set<HTMLElement>;
}): FocusCandidateWatcher {
  const { root, registry } = options;

  /** C2(a): the topmost active takeover, or null. Document order is the
   * stacking order for the fixed overlays here, so the LAST marked element
   * in the tree is the one on top. */
  function activeTakeover(): HTMLElement | null {
    const marks = root.querySelectorAll<HTMLElement>(`[${TAKEOVER_ATTRIBUTE}]`);
    return marks.length > 0 ? marks[marks.length - 1] : null;
  }

  /** C2(b): on-screen check for a candidate — walks the ancestor chain to
   * `root` because `display:none` does not compute onto descendants while
   * `visibility:hidden` does (the walk catches both, plus the `hidden`
   * attribute at any level). A detached burst (ownerDocument without a view)
   * reads as visible; `root.contains` gates liveness separately. */
  function isSpatiallyVisible(element: HTMLElement): boolean {
    const view = element.ownerDocument?.defaultView;
    if (!view) return true;
    let node: HTMLElement | null = element;
    while (node && root.contains(node)) {
      if (node.hasAttribute('hidden')) return false;
      const style = view.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      node = node.parentElement;
    }
    return true;
  }

  /** C2(a): when a NEW takeover mounts over a live focus, the D-pad's ENTER
   * target must not stay parked on a control the user cannot see. Blur the
   * stale focus (lands on body) — the watcher REMOVES focus and never moves
   * or claims it; taking focus into the panel would violate the S512
   * containment doctrine the panel itself honors. */
  function releaseForeignFocus(takeover: HTMLElement | null, previous: HTMLElement | null): void {
    if (!takeover || takeover === previous) return;
    const doc = root.ownerDocument;
    const active = doc?.activeElement;
    if (active && active !== doc?.body && !takeover.contains(active)) {
      (active as HTMLElement).blur();
    }
  }

  /** The takeover observed at the last refresh — drives the rise-edge blur
   * and kept in sync with the `spatialTakeover` mirror. */
  let lastTakeover: HTMLElement | null = null;

  /** Register `element` if the directive has not already claimed it. */
  function admit(element: HTMLElement, takeover: HTMLElement | null): void {
    if (registry.has(element) || element.hasAttribute(FOCUSABLE_ATTR)) return;
    if (takeover && !takeover.contains(element)) return;
    if (!isSpatiallyVisible(element)) return;
    registry.add(element);
    element.setAttribute(FOCUSABLE_ATTR, AUTO_FOCUS_MARKER);
  }

  /** Forget shell entries that left the interactive set (detached, disabled,
   * hidden, or simply outside a risen takeover…). */
  function sweep(takeover: HTMLElement | null): void {
    for (const element of Array.from(registry)) {
      if (!isShellOwnedEntry(element)) continue;
      const onScreen =
        root.contains(element) &&
        element.matches(FOCUSABLE_SELECTOR) &&
        isSpatiallyVisible(element) &&
        (!takeover || takeover.contains(element));
      if (onScreen) continue;
      releaseShellEntry(element, registry);
    }
  }

  function refresh(): void {
    const takeover = activeTakeover();
    releaseForeignFocus(takeover, lastTakeover);
    lastTakeover = takeover;
    spatialTakeover.value = takeover;
    for (const element of Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))) {
      admit(element, takeover);
    }
    sweep(takeover);
  }

  // childList catches router-view swaps and modal mounts; the attribute set
  // catches every in-place flip that changes interactive-ness or on-screen-ness
  // without node movement: `disabled` (Vue assigns the reflected IDL
  // attribute), `hidden` / `style` (v-show flips display in place, C2(b)) and
  // `data-spatial-takeover` (a takeover appearing by attribute on a live
  // node, not only by mount, C2(a)). Attribute churn coalesces with node
  // churn on the same burst.
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    void Promise.resolve().then(() => {
      queued = false;
      refresh();
    });
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled', 'hidden', 'style', TAKEOVER_ATTRIBUTE],
  });
  refresh();

  return {
    refresh,
    destroy(): void {
      observer.disconnect();
      // The production boot has exactly one watcher; releasing the mirror on
      // its teardown keeps "no takeover" the honest default for late readers.
      spatialTakeover.value = null;
      lastTakeover = null;
      for (const element of Array.from(registry)) {
        if (!isShellOwnedEntry(element)) continue;
        releaseShellEntry(element, registry);
      }
    }
  };
}
