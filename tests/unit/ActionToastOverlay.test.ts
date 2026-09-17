/**
 * ActionToastOverlay.test — S516 AD-13 transient action-caption pins.
 *
 * AC1: self-clears on the ~1 s timer AND on an explicit remote key (dismiss
 *      path pinned); non-blocking while shown.
 * AC2: focus-safe — showing a caption never moves/creates DOM focus, the root
 *      carries no tabindex + is aria-hidden, and dismissal is key-reachable.
 * AC3: the RENDER never stacks — one visible slot at a time. S526/AD-10 keeps
 *      that guarantee while generalising the store behind it into a bounded
 *      FIFO: a burst of DISTINCT actions now queues in order (the single armed
 *      timer drains head→next) instead of clobbering; a held-key repeat of the
 *      SAME caption still just refreshes the one window (S516 pin).
 *
 * The REAL `remoteManager` singleton is used: the component wires to the live
 * event bus, so emits + one legacy-dispatched document keydown pin the actual
 * production seam (the fakeKeyEvent shape follows RemoteManager.test.ts).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import remoteManager from '@/remote/RemoteManager';
import ActionToastOverlay from '@/components/ActionToastOverlay.vue';
import {
  useActionToastStore,
  ACTION_TOAST_AUTO_CLEAR_MS
} from '@/stores/useActionToastStore';

/** A REAL KeyboardEvent (jsdom refuses plain objects at dispatchEvent) with
 * the legacy `keyCode` the RemoteManager reads overridden onto it — same shape
 * the production webview delivers. */
function legacyKeyDown(keyCode: number): void {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'keyCode', { get: () => keyCode });
  document.dispatchEvent(event);
}

/** A focusable neighbour standing in for "the control the viewer is on". */
function mountOverlay(pinia: Pinia) {
  document.body.innerHTML = '<input id="other-focus" type="text" />' as unknown as string;
  const focusTarget = document.getElementById('other-focus') as HTMLElement;
  focusTarget.setAttribute('tabindex', '0');
  focusTarget.focus();
  expect(document.activeElement).toBe(focusTarget);
  return mount(ActionToastOverlay, { attachTo: document.body, global: { plugins: [pinia] } });
}

let pinia: Pinia;

// Fresh pinia per test (the store is app-scoped through it).
beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
});

afterEach(() => {
  // Drop any caption still showing so its timer can't leak into the next test
  // (unmount's dismiss only covers what THIS test's wrapper rendered).
  useActionToastStore().dismiss();
  document.body.innerHTML = '';
});

describe('useActionToastStore (S516 AD-13)', () => {
  it('show() paints the single slot and self-clears on the ~1 s timer', () => {
    vi.useFakeTimers();
    const toast = useActionToastStore();
    toast.show('Play');
    expect(toast.caption).toBe('Play');
    expect(toast.visible).toBe(true);
    vi.advanceTimersByTime(ACTION_TOAST_AUTO_CLEAR_MS - 1);
    expect(toast.caption).toBe('Play');
    vi.advanceTimersByTime(1);
    expect(toast.caption).toBeNull();
    expect(toast.visible).toBe(false);
  });

  it('a burst of distinct actions QUEUES in order yet keeps exactly ONE armed timer (S510 no-stack, S526 FIFO)', () => {
    vi.useFakeTimers();
    const toast = useActionToastStore();
    toast.show('Play');
    toast.show('Pause');
    // The first announcement is on screen; the second waits its turn — the
    // render slot never stacks, but nothing is silently clobbered either.
    expect(toast.caption).toBe('Play');
    expect(toast.pending).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
    // One window elapses: Play clears, the queue drains Pause into the slot
    // (re-arming the SAME single window), still exactly one timer live.
    vi.advanceTimersByTime(ACTION_TOAST_AUTO_CLEAR_MS);
    expect(toast.caption).toBe('Pause');
    expect(toast.pending).toBe(0);
    expect(vi.getTimerCount()).toBe(1);
    // The drained caption then self-clears to an empty feed with no timer left.
    vi.advanceTimersByTime(ACTION_TOAST_AUTO_CLEAR_MS);
    expect(toast.caption).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('dismiss() clears early and disarms the timer', () => {
    vi.useFakeTimers();
    const toast = useActionToastStore();
    toast.show('Rewind');
    toast.dismiss();
    expect(toast.caption).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(ACTION_TOAST_AUTO_CLEAR_MS * 2);
    expect(toast.caption).toBeNull();
  });

  it('empty captions are refused (nothing to echo)', () => {
    const toast = useActionToastStore();
    toast.show('');
    expect(toast.caption).toBeNull();
  });

  it('identical consecutive captions bump the nonce so the render window restarts', () => {
    const toast = useActionToastStore();
    toast.show('Play/Pause');
    const first = toast.nonce;
    toast.show('Play/Pause');
    expect(toast.nonce).toBe(first + 1);
    expect(toast.caption).toBe('Play/Pause');
  });
});

describe('ActionToastOverlay (S516 AD-13)', () => {
  it('a PLAY_PAUSE remote action captions through the live bus + KeyMapping display name', async () => {
    const wrapper = mountOverlay(pinia);
    remoteManager.emit('action', { key: 'PLAY_PAUSE' });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe('Play/Pause');
    wrapper.unmount();
  });

  it('AC1 — real document keydown through the RemoteManager seam shows the action caption', async () => {
    const wrapper = mountOverlay(pinia);
    // 10252 = the S509 dedicated Play/Pause toggle.
    legacyKeyDown(10252);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe('Play/Pause');
    wrapper.unmount();
  });

  it('AC1 — the NEXT remote key dismisses the current caption (key-activatable, single slot)', async () => {
    const wrapper = mountOverlay(pinia);
    remoteManager.emit('action', { key: 'PAUSE' });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe('Pause');
    // 37 = LEFT: mapped (keydown fires) but NOT immediate → pure dismissal.
    legacyKeyDown(37);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe('');
    wrapper.unmount();
  });

  it('AC3 — held-key repeat refreshes the ONE caption, never stacks', async () => {
    const wrapper = mountOverlay(pinia);
    remoteManager.emit('action', { key: 'FAST_FORWARD' });
    remoteManager.emit('action', { key: 'FAST_FORWARD', repeat: true });
    remoteManager.emit('action', { key: 'FAST_FORWARD', repeat: true });
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.action-toast')).toHaveLength(1);
    expect(wrapper.text()).toBe('Fast Forward');
    wrapper.unmount();
  });

  it('AC2 — showing a caption never steals focus and the root is inert chrome', async () => {
    const wrapper = mountOverlay(pinia);
    remoteManager.emit('action', { key: 'STOP' });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe('Stop');
    // Focus still sits on the neighbour control — the toast never focused itself.
    const focusTarget = document.getElementById('other-focus') as HTMLElement;
    expect(focusTarget.isSameNode(document.activeElement)).toBe(true);
    const root = wrapper.get('.action-toast').element;
    expect(root.hasAttribute('tabindex')).toBe(false);
    expect(root.getAttribute('aria-hidden')).toBe('true');
    wrapper.unmount();
  });

  it('focus-landed echo: focusin on a labelled control captions it', async () => {
    const wrapper = mountOverlay(pinia);
    const field = document.getElementById('other-focus') as HTMLElement;
    field.setAttribute('aria-label', 'Server address');
    field.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe('Server address');
    wrapper.unmount();
  });

  it('focus-landed echo collapses whitespace and truncates long labels honestly', async () => {
    const wrapper = mountOverlay(pinia);
    const span = document.createElement('span');
    span.setAttribute('tabindex', '0');
    span.textContent = '  Continue   watching   '.repeat(5);
    document.body.appendChild(span);
    span.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await wrapper.vm.$nextTick();
    const caption = wrapper.text();
    expect(caption.startsWith('Continue watching')).toBe(true);
    expect(caption.length).toBeLessThanOrEqual(48);
    expect(caption.endsWith('\u2026')).toBe(true);
    wrapper.unmount();
  });

  it('focusin on an unlabelled, empty element shows nothing', async () => {
    const wrapper = mountOverlay(pinia);
    const bare = document.createElement('div');
    document.body.appendChild(bare);
    bare.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe('');
    wrapper.unmount();
  });

  it('self-clears after the auto window while mounted', async () => {
    vi.useFakeTimers();
    const wrapper = mountOverlay(pinia);
    remoteManager.emit('action', { key: 'PLAY' });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe('Play');
    vi.advanceTimersByTime(ACTION_TOAST_AUTO_CLEAR_MS);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe('');
    vi.useRealTimers();
    wrapper.unmount();
  });

  it('unmount detaches every listener — later keys are inert (T-05)', async () => {
    const wrapper = mountOverlay(pinia);
    wrapper.unmount();
    expect(() => legacyKeyDown(415)).not.toThrow();
    expect(document.querySelector('.action-toast')).toBeNull();
  });
});
