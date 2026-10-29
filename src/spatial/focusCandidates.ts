/**
 * Keeps @phlix/ui's spatial-navigation candidate registry populated from the
 * live DOM, so the remote D-pad has somewhere to move.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

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

  /** Register `element` if the directive has not already claimed it. */
  function admit(element: HTMLElement): void {
    if (registry.has(element) || element.hasAttribute(FOCUSABLE_ATTR)) return;
    registry.add(element);
    element.setAttribute(FOCUSABLE_ATTR, AUTO_FOCUS_MARKER);
  }

  /** Forget shell entries that left the interactive set (detached, disabled…). */
  function sweep(): void {
    for (const element of Array.from(registry)) {
      if (!isShellOwnedEntry(element)) continue;
      if (root.contains(element) && element.matches(FOCUSABLE_SELECTOR)) continue;
      releaseShellEntry(element, registry);
    }
  }

  function refresh(): void {
    for (const element of Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))) {
      admit(element);
    }
    sweep();
  }

  // childList catches router-view swaps and modal mounts; `disabled` catches
  // the one in-place attribute flip that changes interactive-ness without any
  // node movement (Vue assigns the reflected IDL attribute, which Mutation-
  // observes). Attribute churn coalesces with node churn on the same burst.
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    void Promise.resolve().then(() => {
      queued = false;
      refresh();
    });
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  refresh();

  return {
    refresh,
    destroy(): void {
      observer.disconnect();
      for (const element of Array.from(registry)) {
        if (!isShellOwnedEntry(element)) continue;
        releaseShellEntry(element, registry);
      }
    }
  };
}
