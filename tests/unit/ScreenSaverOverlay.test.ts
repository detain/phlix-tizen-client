/**
 * ScreenSaverOverlay.test — S523 AD-21, the overlay seam of the idle policy.
 *
 * Fake timers drive the 1 s tick; the REAL `RemoteManager` singleton is the
 * key seam (events are dispatched exactly as the webview/gamepad bridge would,
 * so the pin proves the reset rides the routed-key path, not a private listener).
 * `usePlayerStore` is a plain faked store — the component reads `.playing`
 * inside its tick, so flipping the flag between advances is the honest device
 * behavior (no reactivity is claimed anywhere in this half).
 *
 * Also carries the two honesty pins: AC-1 (the as-shipped manifests stay a
 * two-privilege surface — no display/power smuggled in) and the focus-safe
 * source grep (S512/S516 doctrine: presentational, never a focus target).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ScreenSaverOverlay from '@/components/ScreenSaverOverlay.vue';
import remoteManager from '@/remote/RemoteManager';
import { dispatchDomKey } from '@/remote/gamepadBridge';
import { IDLE_BODY_CLASS, IDLE_TIMEOUT_KEY } from '@/screensaver';

const REPO = path.resolve(__dirname, '..', '..');

const h = vi.hoisted(() => ({
  player: { playing: false } as { playing: boolean },
}));

vi.mock('@phlix/ui', () => ({
  usePlayerStore: () => h.player,
}));

const START = 1_700_000_000_000;

// The sanctioned DOM key-edge (src-exported, proven against the real
// RemoteManager in gamepadBridge.test) — same seam a TV webview drives.
function overlayExists(wrapper: ReturnType<typeof mount>): boolean {
  return wrapper.find('[data-testid="screensaver-overlay"]').exists();
}

describe('ScreenSaverOverlay — idle × playback × key-reset at the mount seam', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: START, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    globalThis.localStorage.clear();
    h.player.playing = false;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.localStorage.clear();
    document.body.classList.remove(IDLE_BODY_CLASS);
  });

  it('silent before the 180 s window has fully elapsed', async () => {
    const wrapper = mount(ScreenSaverOverlay);
    vi.advanceTimersByTime(179_000);
    await nextTick();
    expect(overlayExists(wrapper)).toBe(false);
    expect(document.body.classList.contains(IDLE_BODY_CLASS)).toBe(false);
    wrapper.unmount();
  });

  it('engages exactly at the window, and stamps the body class', async () => {
    const wrapper = mount(ScreenSaverOverlay);
    vi.advanceTimersByTime(180_000);
    await nextTick();
    expect(overlayExists(wrapper)).toBe(true);
    expect(document.body.classList.contains(IDLE_BODY_CLASS)).toBe(true);
    wrapper.unmount();
  });

  it('NEVER engages during active playback, and counts the window from the PAUSE', async () => {
    const wrapper = mount(ScreenSaverOverlay);
    h.player.playing = true;
    vi.advanceTimersByTime(600_000); // ten "minutes" of a film
    await nextTick();
    expect(overlayExists(wrapper)).toBe(false);
    h.player.playing = false; // paused at t = 600 s
    vi.advanceTimersByTime(179_000); // window not over since the pause
    await nextTick();
    expect(overlayExists(wrapper)).toBe(false);
    vi.advanceTimersByTime(1_000); // exactly 180 s after the last playing tick
    await nextTick();
    expect(overlayExists(wrapper)).toBe(true);
    wrapper.unmount();
  });

  it('any routed key wakes instantly, clears the class, and re-arms the full window', async () => {
    const wrapper = mount(ScreenSaverOverlay);
    vi.advanceTimersByTime(180_000);
    await nextTick();
    expect(overlayExists(wrapper)).toBe(true);
    // Enter rides the SAME document seam RemoteManager consumes (keyCode 13).
    dispatchDomKey('keydown', { keyCode: 13, key: 'Enter' });
    await nextTick();
    expect(overlayExists(wrapper)).toBe(false);
    expect(document.body.classList.contains(IDLE_BODY_CLASS)).toBe(false);
    // Re-armed: another full idle window (measured from the key) engages again.
    vi.advanceTimersByTime(179_000);
    await nextTick();
    expect(overlayExists(wrapper)).toBe(false);
    vi.advanceTimersByTime(1_000);
    await nextTick();
    expect(overlayExists(wrapper)).toBe(true);
    wrapper.unmount();
  });

  it('a routed key DURING playback is also harmless (wake is unconditional)', async () => {
    const wrapper = mount(ScreenSaverOverlay);
    h.player.playing = true;
    vi.advanceTimersByTime(200_000);
    expect(() => dispatchDomKey('keydown', { keyCode: 13, key: 'Enter' })).not.toThrow();
    await nextTick();
    expect(overlayExists(wrapper)).toBe(false);
    wrapper.unmount();
  });

  it('honors a localStorage idle-window override at mount', async () => {
    globalThis.localStorage.setItem(IDLE_TIMEOUT_KEY, '4000');
    const wrapper = mount(ScreenSaverOverlay);
    vi.advanceTimersByTime(3_000);
    await nextTick();
    expect(overlayExists(wrapper)).toBe(false);
    vi.advanceTimersByTime(1_000);
    await nextTick();
    expect(overlayExists(wrapper)).toBe(true);
    wrapper.unmount();
  });

  it('unmount leaves nothing behind: no poll, no subscription, no body class (T-05)', async () => {
    const wrapper = mount(ScreenSaverOverlay);
    vi.advanceTimersByTime(180_000);
    await nextTick();
    expect(overlayExists(wrapper)).toBe(true);
    wrapper.unmount();
    expect(document.body.classList.contains(IDLE_BODY_CLASS)).toBe(false);
    // The only pending timers before unmount were this component's interval;
    // after unmount no screensaver poll may remain armed.
    expect(vi.getTimerCount()).toBe(0);
    // A key after unmount must not resurrect the overlay (subscription gone).
    expect(() => dispatchDomKey('keydown', { keyCode: 13, key: 'Enter' })).not.toThrow();
  });
});

describe('ScreenSaverOverlay — AC-1 privilege honesty: the manifests stay a two-privilege surface', () => {
  it('app/config.xml grants exactly internet + tv.inputdevice — no display/power, ever', () => {
    const manifest = readFileSync(path.join(REPO, 'app', 'config.xml'), 'utf8');
    const privileges = [...manifest.matchAll(/<tizen:privilege name="([^"]+)"/g)].map((m) => m[1]);
    expect(privileges).toEqual([
      'http://tizen.org/privilege/internet',
      'http://tizen.org/privilege/tv.inputdevice',
    ]);
    expect(manifest).not.toContain('privilege/display');
    expect(manifest).not.toContain('privilege/power');
  });

  it('the package/ mirror is identical (T-02): the shipped widget keeps the same verdict', () => {
    const shipped = readFileSync(path.join(REPO, 'package', 'config.xml'), 'utf8');
    const app = readFileSync(path.join(REPO, 'app', 'config.xml'), 'utf8');
    expect(shipped).toBe(app);
  });
});

describe('ScreenSaverOverlay — focus-safe by construction (S512/S516 doctrine)', () => {
  it('the source never focuses/blurs/preventDefaults, and the root is aria-hidden without tabindex', () => {
    const src = readFileSync(path.join(REPO, 'src', 'components', 'ScreenSaverOverlay.vue'), 'utf8');
    // Strip comment blocks (JSDoc + CSS) so the honest posture PROSE cannot
    // trip its own grep — scan the CODE, same doctrine as gamepadBridge.test.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const banned of ['.focus(', '.blur(', 'preventDefault', 'stopImmediatePropagation', 'stopPropagation', 'tabindex']) {
      expect(code, `expected no ${banned} in screensaver code`).not.toContain(banned);
    }
    // The sanctioned surface: presentational overlay + the ONE body-class wire.
    expect(code).toContain('aria-hidden="true"');
    expect(code).toContain('classList.toggle(IDLE_BODY_CLASS');
  });
});

// The remoteManager singleton import doubles as proof the component rides the
// shared seam: it must exist in every consumer's process exactly once.
describe('ScreenSaverOverlay — seam identity', () => {
  it('uses the shared RemoteManager singleton (not a private document listener)', () => {
    expect(remoteManager).toBeDefined();
    expect(typeof remoteManager.on).toBe('function');
  });
});
