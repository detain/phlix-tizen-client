/**
 * C27 / review tizen__gameux: the spatial engine's candidate pool (`focusableRegistry`
 * from @phlix/ui) had no producer on any real surface — `v-focusable` is never
 * invoked in the pinned ui bundle — so D-pad navigation was inert. These tests
 * pin the shell-side candidate watcher that replaces that missing producer.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  AUTO_FOCUS_MARKER,
  FOCUSABLE_SELECTOR,
  TAKEOVER_ATTRIBUTE,
  spatialTakeover,
  createFocusCandidateWatcher,
  type FocusCandidateWatcher
} from '@/spatial/focusCandidates';

/** MutationObserver callbacks arrive as microtasks; a macrotask tick drains them. */
function flushMutations(): Promise<void> {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function makeElement(tag: string, attributes: Record<string, string> = {}): HTMLElement {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}

describe('focusCandidates', () => {
  let root: HTMLElement;
  let registry: Set<HTMLElement>;
  let watcher: FocusCandidateWatcher | null;

  function startWatcher(active?: boolean): FocusCandidateWatcher {
    watcher = createFocusCandidateWatcher({ root, registry, active });
    return watcher;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    watcher?.destroy();
    watcher = null;
    root?.remove();
    registry?.clear();
  });

  function scaffold(initialHtml = ''): void {
    root = makeElement('div');
    root.innerHTML = initialHtml;
    document.body.appendChild(root);
    registry = new Set<HTMLElement>();
  }

  it('registers the whole interactive set of a freshly mounted surface', () => {
    scaffold(
      '<a href="#/browse">Browse</a><button>Play</button><input><select></select>' +
        '<textarea></textarea><div tabindex="0">Card</div><div>Plain</div>' +
        '<button disabled>Off</button>'
    );
    startWatcher();

    const [link, button, input, select, textarea, card] = Array.from(
      root.querySelectorAll<HTMLElement>('a, button, input, select, textarea, div')
    );
    for (const element of [link, button, input, select, textarea, card]) {
      expect(registry.has(element)).toBe(true);
      expect(element.getAttribute('data-focusable')).toBe(AUTO_FOCUS_MARKER);
    }
    // Selector is exported and matches the same string the row-snap probe uses.
    expect(FOCUSABLE_SELECTOR).toContain('button:not([disabled])');
  });

  it('never stamps tabindex — native focusability is already guaranteed', () => {
    scaffold('<button id="solo">OK</button>');
    startWatcher();
    const button = root.querySelector<HTMLButtonElement>('#solo')!;
    expect(registry.has(button)).toBe(true);
    expect(button.hasAttribute('tabindex')).toBe(false);
  });

  it('ignores non-interactive nodes and disabled buttons', () => {
    scaffold('<div>Nope</div><button disabled>Off</button><span>x</span>');
    startWatcher();
    expect(registry.size).toBe(0);
  });

  it('picks up nodes added to the surface after registration', async () => {
    scaffold();
    startWatcher();
    expect(registry.size).toBe(0);

    const late = makeElement('button');
    root.appendChild(late);
    await flushMutations();
    expect(registry.has(late)).toBe(true);
  });

  it('drops nodes removed from the surface and un-stamps them', async () => {
    scaffold('<button id="bye">Leave</button>');
    startWatcher();
    const button = root.querySelector<HTMLButtonElement>('#bye')!;
    expect(registry.has(button)).toBe(true);

    button.remove();
    await flushMutations();
    expect(registry.has(button)).toBe(false);
    expect(button.hasAttribute('data-focusable')).toBe(false);
  });

  it('drops an element the moment it turns disabled (in-place flip)', async () => {
    scaffold('<button id="flip">Toggle</button>');
    startWatcher();
    const button = root.querySelector<HTMLButtonElement>('#flip')!;
    expect(registry.has(button)).toBe(true);

    button.disabled = true;
    await flushMutations();
    expect(registry.has(button)).toBe(false);
  });

  it('leaves directive-owned registry entries alone', () => {
    scaffold('<button id="directed">Directive</button>');
    const button = root.querySelector<HTMLButtonElement>('#directed')!;
    // The ui v-focusable directive marks its elements data-focusable="" (empty).
    button.setAttribute('data-focusable', '');
    registry = new Set<HTMLElement>([button]);
    startWatcher();

    expect(registry.has(button)).toBe(true);
    expect(button.getAttribute('data-focusable')).toBe('');

    // Even after detachment the shell must not reclaim directive-owned state.
    button.remove();
    registry.clear();
    registry.add(button);
    watcher?.refresh();
    expect(registry.has(button)).toBe(true);
    expect(button.getAttribute('data-focusable')).toBe('');
  });

  it('destroy releases every shell-owned entry and disconnects the observer', async () => {
    scaffold('<button>A</button><a href="#x">B</a>');
    const active = startWatcher();
    expect(registry.size).toBe(2);

    active.destroy();
    expect(registry.size).toBe(0);
    for (const element of Array.from(root.children)) {
      expect(element.hasAttribute('data-focusable')).toBe(false);
    }

    // Observer is gone: new nodes no longer register.
    const late = makeElement('button');
    root.appendChild(late);
    await flushMutations();
    expect(registry.has(late)).toBe(false);
  });

  it('refresh is idempotent and re-admits nothing twice', () => {
    scaffold('<button>One</button><a href="#two">Two</a>');
    const active = startWatcher();
    const size = registry.size;
    active.refresh();
    active.refresh();
    expect(registry.size).toBe(size);
  });

  // --- C2 (review tizen__gameux Critical + tizen__crossfe Minor 2) ----------

  it('never registers a v-show-hidden (display:none) control, and admits it when shown again', async () => {
    scaffold('<button id="ghost" style="display:none">Hidden</button>');
    startWatcher();
    const ghost = root.querySelector<HTMLButtonElement>('#ghost')!;
    expect(registry.has(ghost)).toBe(false);

    ghost.style.display = '';
    await flushMutations();
    expect(registry.has(ghost)).toBe(true);

    ghost.style.display = 'none';
    await flushMutations();
    expect(registry.has(ghost)).toBe(false);
  });

  it('never registers a node under a hidden or visibility-hidden ancestor', () => {
    scaffold(
      '<div hidden><button id="underHidden">H</button></div>' +
        '<div style="visibility:hidden"><button id="underInvisible">V</button></div>'
    );
    startWatcher();
    expect(registry.has(root.querySelector<HTMLElement>('#underHidden')!)).toBe(false);
    expect(registry.has(root.querySelector<HTMLElement>('#underInvisible')!)).toBe(false);
  });

  it('drops nodes whose subtree is hidden in place (sweep, not just admit)', async () => {
    scaffold('<button id="live">On screen</button>');
    startWatcher();
    const live = root.querySelector<HTMLButtonElement>('#live')!;
    expect(registry.has(live)).toBe(true);

    live.setAttribute('hidden', '');
    await flushMutations();
    expect(registry.has(live)).toBe(false);
    expect(live.hasAttribute('data-focusable')).toBe(false);
  });

  it('a mounted takeover owns the pool: foreign shell entries are swept and re-admitted after it retires', async () => {
    scaffold('<button id="beneath">Under the panel</button>');
    startWatcher();
    const beneath = root.querySelector<HTMLButtonElement>('#beneath')!;
    expect(registry.has(beneath)).toBe(true);

    const takeover = makeElement('div', { [TAKEOVER_ATTRIBUTE]: '' });
    const inside = makeElement('button', { id: 'inside' });
    takeover.append(inside);
    root.appendChild(takeover);
    await flushMutations();

    // Only the takeover subtree is navigable while it is up (C2(a)).
    expect(registry.has(beneath)).toBe(false);
    expect(registry.has(inside)).toBe(true);
    expect(spatialTakeover.value).toBe(takeover);

    takeover.remove();
    await flushMutations();
    expect(registry.has(beneath)).toBe(true);
    expect(registry.has(inside)).toBe(false);
    expect(spatialTakeover.value).toBeNull();
  });

  it('a takeover appearing by attribute flip (no mount) gates the pool too', async () => {
    scaffold('<div id="layer"><button>In</button></div><button id="out">Out</button>');
    startWatcher();
    const layer = root.querySelector('#layer')!;
    const out = root.querySelector<HTMLButtonElement>('#out')!;
    const inBtn = layer.querySelector('button')!;
    expect(registry.has(out)).toBe(true);
    expect(registry.has(inBtn)).toBe(true);

    layer.setAttribute(TAKEOVER_ATTRIBUTE, '');
    await flushMutations();
    expect(registry.has(out)).toBe(false);
    expect(registry.has(inBtn)).toBe(true);
    expect(spatialTakeover.value).toBe(layer);
    layer.removeAttribute(TAKEOVER_ATTRIBUTE);
    await flushMutations();
    expect(spatialTakeover.value).toBeNull();
  });

  it('a focus parked under a rising takeover is released, never re-aimed', async () => {
    scaffold('<button id="parked">Has focus</button>');
    startWatcher();
    const parked = root.querySelector<HTMLButtonElement>('#parked')!;
    parked.focus();
    expect(document.activeElement).toBe(parked);

    const takeover = makeElement('div', { [TAKEOVER_ATTRIBUTE]: '' });
    const inside = makeElement('button');
    takeover.append(inside);
    root.appendChild(takeover);
    await flushMutations();

    // The stale ENTER target is gone (blur → body); nothing stole focus
    // (S512: the watcher REMOVES focus, it never moves or claims it).
    expect(document.activeElement).toBe(document.body);
    expect(takeover.contains(document.activeElement)).toBe(false);
  });

  it('the topmost (last-mounted) takeover wins', async () => {
    scaffold('<button id="deep">B</button>');
    startWatcher();
    const lower = makeElement('div', { [TAKEOVER_ATTRIBUTE]: '' });
    const upper = makeElement('div', { [TAKEOVER_ATTRIBUTE]: '' });
    const inUpper = makeElement('button');
    upper.append(inUpper);
    root.append(lower, upper);
    await flushMutations();
    expect(spatialTakeover.value).toBe(upper);
    expect(registry.has(inUpper)).toBe(true);
    expect(registry.has(root.querySelector<HTMLElement>('#deep')!)).toBe(false);
  });

  it('destroy clears the takeover mirror', async () => {
    scaffold(`<div ${TAKEOVER_ATTRIBUTE}><button>In</button></div>`);
    const active = startWatcher();
    expect(spatialTakeover.value).not.toBeNull();
    active.destroy();
    expect(spatialTakeover.value).toBeNull();
    watcher = null;
  });

  // TIZ-2: the full candidate scan (querySelectorAll + a computed-style
  // ancestor walk per candidate) used to run on EVERY coalesced mutation
  // burst app-wide — including the player route, where the engine is off and
  // the chrome churns `style` continuously. The pool is now gated on the
  // engine's own enabled predicate: idle = no scan, no style observation.
  describe('enabled gate (TIZ-2)', () => {
    it('an idle watcher registers nothing and never walks computed style on style churn', async () => {
      scaffold('<button id="a">A</button><div id="bar" style="width: 0%"></div>');
      const computed = vi.spyOn(window, 'getComputedStyle');
      startWatcher(false);
      expect(registry.size).toBe(0);

      const bar = root.querySelector<HTMLElement>('#bar')!;
      for (let pct = 1; pct <= 5; pct++) {
        bar.style.width = `${pct}%`;
        await flushMutations();
      }
      root.append(makeElement('button'));
      await flushMutations();

      expect(registry.size).toBe(0);
      expect(computed).not.toHaveBeenCalled();
    });

    it('going idle releases every shell-owned entry; going live re-admits the surface', async () => {
      scaffold('<button id="a">A</button>');
      const live = startWatcher();
      const button = root.querySelector<HTMLElement>('#a')!;
      expect(registry.has(button)).toBe(true);

      live.setActive(false);
      expect(registry.has(button)).toBe(false);
      expect(button.hasAttribute('data-focusable')).toBe(false);

      // Churn while idle is not tracked…
      const late = makeElement('button');
      root.append(late);
      await flushMutations();
      expect(registry.has(late)).toBe(false);

      // …and the resume edge re-scans synchronously, then observes again.
      live.setActive(true);
      expect(registry.has(button)).toBe(true);
      expect(registry.has(late)).toBe(true);
      const later = makeElement('button');
      root.append(later);
      await flushMutations();
      expect(registry.has(later)).toBe(true);
    });

    it('idle keeps directive-owned entries untouched', () => {
      scaffold('<button id="d" data-focusable="">D</button>');
      const directive = root.querySelector<HTMLElement>('#d')!;
      registry.add(directive);
      const live = startWatcher();
      live.setActive(false);
      expect(registry.has(directive)).toBe(true);
      expect(directive.getAttribute('data-focusable')).toBe('');
    });

    it('the takeover mirror stays honest while idle (M6 consent card reads it app-wide)', async () => {
      scaffold('<button id="under">U</button>');
      startWatcher(false);
      expect(spatialTakeover.value).toBeNull();

      const panel = makeElement('div', { [TAKEOVER_ATTRIBUTE]: '' });
      panel.append(makeElement('button'));
      root.append(panel);
      await flushMutations();
      expect(spatialTakeover.value).toBe(panel);
      expect(registry.size).toBe(0);

      panel.removeAttribute(TAKEOVER_ATTRIBUTE);
      await flushMutations();
      expect(spatialTakeover.value).toBeNull();
    });

    it('setActive after destroy is inert', async () => {
      scaffold('<button id="a">A</button>');
      const live = startWatcher();
      live.destroy();
      watcher = null;
      live.setActive(true);
      root.append(makeElement('button'));
      await flushMutations();
      expect(registry.size).toBe(0);
    });
  });
});
