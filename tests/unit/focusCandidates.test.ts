/**
 * C27 / review tizen__gameux: the spatial engine's candidate pool (`focusableRegistry`
 * from @phlix/ui) had no producer on any real surface — `v-focusable` is never
 * invoked in the pinned ui bundle — so D-pad navigation was inert. These tests
 * pin the shell-side candidate watcher that replaces that missing producer.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  AUTO_FOCUS_MARKER,
  FOCUSABLE_SELECTOR,
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

  function startWatcher(): FocusCandidateWatcher {
    watcher = createFocusCandidateWatcher({ root, registry });
    return watcher;
  }

  afterEach(() => {
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
});
