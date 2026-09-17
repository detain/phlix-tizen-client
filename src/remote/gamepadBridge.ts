/**
 * Gamepad → synthetic-keyboard bridge (S522 / AD-20).
 *
 * WHAT IT DOES: reads the W3C Gamepad API each animation frame and translates a
 * handful of inputs into the EXACT SAME `document` keydown/keyup events the
 * Samsung remote produces, so every existing consumer — `RemoteManager` (which
 * reads `event.keyCode`) and `@phlix/ui`'s `useSpatialNav` (which reads
 * `event.key`) — reacts to a gamepad with ZERO change of its own:
 *   - D-pad ↑↓←→ (buttons 12–15) and the left stick (axes 0/1, 0.5 deadzone,
 *     dominant axis) → `ArrowUp/Down/Left/Right`, auto-repeating while held
 *     (400 ms initial, then 150 ms) exactly like a held key.
 *   - A (button 0) → `Enter` (native focus activation of the spatial-nav selection).
 *   - B (button 1) → the Samsung BACK code `10009`, which `KeyMapping` already
 *     resolves to the immediate `BACK` action — so `tizenBridge` dismisses the
 *     quality menu / pops the route, no new mapping.
 *
 * DESIGN POSTURE (survey-a, unanimous): this is DEV / MANUAL-QA input, not a
 * product surface — a real Samsung TV has no Gamepad API and no controller. Two
 * consequences, both honored below:
 *   - the whole module performs NO `focus()` and NO DOM mutation; it only
 *     dispatches keyboard events, so the S512/S516 focus-containment discipline
 *     is untouched by construction;
 *   - when `navigator.getGamepads` is absent the bridge installs as a silent
 *     no-op, so boot stays byte-identical on a TV (and in every existing test).
 *
 * The polling logic is a PURE function (`pollGamepad`) over an injected
 * `getGamepads` reader, an injected `dispatch`, an injected `now`, and a caller-
 * owned mutable `state` — jsdom has no Gamepad API or real timers, so the tests
 * drive it entirely with fakes. `installGamepadBridge` is the thin impure edge
 * (rAF loop + singleton guard) that the tests inject around.
 *
 * @category Input Bridge
 * @duplicate No phlix-ui equivalent — @phlix/ui consumes DOM keyboard events;
 * this repo is the only place that knows how a physical remote maps to them, so
 * the gamepad adapter that feeds that same seam belongs here.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

/** One `buttons[]` slot as far as we read it (real GamepadButton is wider). */
export interface GamepadButtonLike {
  pressed: boolean;
}

/** One gamepad as far as the poller reads it (real Gamepad is wider). */
export interface GamepadLike {
  connected: boolean;
  buttons: ArrayLike<GamepadButtonLike | undefined>;
  axes: ArrayLike<number | undefined>;
}

/** The two event kinds the bridge ever synthesises. */
export type DispatchKind = 'keydown' | 'keyup';

/** A synthesised key: the numeric code `RemoteManager` reads + the name spatial-nav reads. */
export interface KeySpec {
  keyCode: number;
  key: string;
}

export type GamepadDispatch = (kind: DispatchKind, spec: KeySpec) => void;
export type GetGamepads = () => Array<GamepadLike | null | undefined>;

/** W3C standard-gamepad button indices we consume. */
const BTN_A = 0;
const BTN_B = 1;
const BTN_DPAD_UP = 12;
const BTN_DPAD_DOWN = 13;
const BTN_DPAD_LEFT = 14;
const BTN_DPAD_RIGHT = 15;

/**
 * Analogue-stick magnitude below which a direction is ignored, and the repeat
 * cadence while a direction is held: first auto-repeat `INITIAL` ms after the
 * press, then every `SUBSEQUENT` ms thereafter. Mirrors a held remote D-pad.
 */
export const GAMEPAD_DEADZONE = 0.5;
export const GAMEPAD_INITIAL_REPEAT_MS = 400;
export const GAMEPAD_SUBSEQUENT_REPEAT_MS = 150;

const ARROW_UP: KeySpec = { keyCode: 38, key: 'ArrowUp' };
const ARROW_DOWN: KeySpec = { keyCode: 40, key: 'ArrowDown' };
const ARROW_LEFT: KeySpec = { keyCode: 37, key: 'ArrowLeft' };
const ARROW_RIGHT: KeySpec = { keyCode: 39, key: 'ArrowRight' };
const KEY_ENTER: KeySpec = { keyCode: 13, key: 'Enter' };
// Samsung's own BACK code — KeyMapping.mapKeyCode(10009) → 'BACK' (immediate),
// so RemoteManager emits the action without us touching the key table.
const KEY_BACK: KeySpec = { keyCode: 10009, key: 'Backspace' };

/** The four directions, in a fixed order so polling is deterministic. */
type Direction = 'up' | 'down' | 'left' | 'right';
const DIRECTIONS: ReadonlyArray<{ dir: Direction; spec: KeySpec; button: number; axis: number; sign: number }> = [
  { dir: 'up', spec: ARROW_UP, button: BTN_DPAD_UP, axis: 1, sign: -1 },
  { dir: 'down', spec: ARROW_DOWN, button: BTN_DPAD_DOWN, axis: 1, sign: 1 },
  { dir: 'left', spec: ARROW_LEFT, button: BTN_DPAD_LEFT, axis: 0, sign: -1 },
  { dir: 'right', spec: ARROW_RIGHT, button: BTN_DPAD_RIGHT, axis: 0, sign: 1 },
];

/** Per-input edge/repeat bookkeeping the poller mutates in place. */
export interface InputSlot {
  down: boolean;
  /** `now` at which the next auto-repeat keydown is due (repeatable inputs only). */
  nextRepeatAt: number;
}

export interface GamepadPollState {
  dirs: Record<Direction, InputSlot>;
  a: InputSlot;
  b: InputSlot;
}

export function createGamepadPollState(): GamepadPollState {
  const slot = (): InputSlot => ({ down: false, nextRepeatAt: 0 });
  return { dirs: { up: slot(), down: slot(), left: slot(), right: slot() }, a: slot(), b: slot() };
}

function buttonPressed(pad: GamepadLike, index: number): boolean {
  const btn = pad.buttons[index];
  return Boolean(btn && btn.pressed);
}

/**
 * Which directions the pad currently reports pressed, merging the digital D-pad
 * with the left analog stick. When the stick is pushed on BOTH axes past the
 * deadzone only the DOMINANT axis (larger magnitude) contributes, so a diagonal
 * push never fires two opposing arrows at once.
 */
function readPressedDirections(pad: GamepadLike): Set<Direction> {
  const pressed = new Set<Direction>();
  for (const { dir, button } of DIRECTIONS) {
    if (buttonPressed(pad, button)) pressed.add(dir);
  }
  const x = pad.axes[0] ?? 0;
  const y = pad.axes[1] ?? 0;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax >= GAMEPAD_DEADZONE || ay >= GAMEPAD_DEADZONE) {
    const stickDir: Direction =
      ax >= ay ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up';
    pressed.add(stickDir);
  }
  return pressed;
}

/** Hold-to-repeat edge driver: keydown on press, repeated keydowns while held, keyup on release. */
function pollRepeatable(st: InputSlot, spec: KeySpec, nowPressed: boolean, now: number, dispatch: GamepadDispatch): void {
  if (nowPressed) {
    if (!st.down) {
      st.down = true;
      st.nextRepeatAt = now + GAMEPAD_INITIAL_REPEAT_MS;
      dispatch('keydown', spec);
    } else if (now >= st.nextRepeatAt) {
      st.nextRepeatAt = now + GAMEPAD_SUBSEQUENT_REPEAT_MS;
      dispatch('keydown', spec);
    }
    return;
  }
  if (st.down) {
    st.down = false;
    st.nextRepeatAt = 0;
    dispatch('keyup', spec);
  }
}

/** Momentary edge driver: keydown on press, keyup on release, never auto-repeats. */
function pollMomentary(st: InputSlot, spec: KeySpec, nowPressed: boolean, dispatch: GamepadDispatch): void {
  if (nowPressed && !st.down) {
    st.down = true;
    dispatch('keydown', spec);
  } else if (!nowPressed && st.down) {
    st.down = false;
    dispatch('keyup', spec);
  }
}

/**
 * One animation frame of translation. Pure over its injected collaborators + the
 * caller-owned `state`: no timers, no globals, no DOM. A pad reading that throws
 * (a mid-unplug `getGamepads`) is the CALLER's concern, not this function's — the
 * install loop fail-softs it so a flaky device never sinks the frame loop.
 */
export function pollGamepad(
  getGamepads: GetGamepads,
  dispatch: GamepadDispatch,
  now: number,
  state: GamepadPollState,
): void {
  const pads = getGamepads();
  const pad = pads.find((p): p is GamepadLike => Boolean(p && p.connected));

  // `readPressedDirections` already OR's the digital D-pad buttons with the
  // dominant analog-stick axis, so the set alone is the current press.
  const pressedDirs = pad ? readPressedDirections(pad) : new Set<Direction>();
  for (const { dir, spec } of DIRECTIONS) {
    pollRepeatable(state.dirs[dir], spec, pressedDirs.has(dir), now, dispatch);
  }
  pollMomentary(state.a, KEY_ENTER, pad ? buttonPressed(pad, BTN_A) : false, dispatch);
  pollMomentary(state.b, KEY_BACK, pad ? buttonPressed(pad, BTN_B) : false, dispatch);
}

/** The real, DOM-backed dispatcher: synthesise a keyboard event on `document`. */
export function dispatchDomKey(kind: DispatchKind, spec: KeySpec): void {
  if (typeof document === 'undefined') {
    return;
  }
  const event = new KeyboardEvent(kind, { key: spec.key, code: spec.key, bubbles: true, cancelable: true });
  // jsdom (and older Chromium) ignore a `keyCode` in the init dict — define the
  // property directly so RemoteManager's `event.keyCode` read sees the TV code.
  Object.defineProperty(event, 'keyCode', { get: () => spec.keyCode });
  Object.defineProperty(event, 'which', { get: () => spec.keyCode });
  document.dispatchEvent(event);
}

export interface GamepadBridgeOverrides {
  getGamepads?: GetGamepads;
  dispatch?: GamepadDispatch;
  now?: () => number;
  requestAnimationFrame?: (cb: () => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
}

/** The live install's teardown, or null when the bridge is not running. */
let installedTeardown: (() => void) | null = null;

/**
 * Read `navigator.getGamepads` as an injected getter, or fall back to the real
 * one. Returns null when there is no Gamepad API — the silent no-op path.
 */
function resolveGamepadReader(override?: GetGamepads): GetGamepads | null {
  if (override) {
    return override;
  }
  const nav = (globalThis as { navigator?: { getGamepads?: () => Array<GamepadLike | null | undefined> } }).navigator;
  if (nav && typeof nav.getGamepads === 'function') {
    return () => Array.from(nav.getGamepads!());
  }
  return null;
}

/**
 * Start the rAF poll loop, idempotently. A second call while one is running
 * returns the SAME teardown and starts no extra loop. With no Gamepad API present
 * (a real TV, or jsdom) it installs nothing and returns a no-op teardown, so the
 * boot path is byte-identical to today. Every frame's poll is wrapped fail-soft so
 * a throwing `getGamepads` can never kill the loop.
 */
export function installGamepadBridge(overrides: GamepadBridgeOverrides = {}): () => void {
  if (installedTeardown) {
    return installedTeardown;
  }

  const getGamepads = resolveGamepadReader(overrides.getGamepads);
  if (!getGamepads) {
    // No Gamepad API — a TV / headless test env. Silent no-op, never installed.
    return () => {
      return;
    };
  }

  const dispatch = overrides.dispatch ?? dispatchDomKey;
  const now = overrides.now ?? Date.now;
  const raf =
    overrides.requestAnimationFrame ??
    ((cb: () => void): number => (globalThis as unknown as { requestAnimationFrame: (c: () => void) => number }).requestAnimationFrame(cb));
  const caf = overrides.cancelAnimationFrame ?? ((h: number): void => (globalThis as unknown as { cancelAnimationFrame: (h: number) => void }).cancelAnimationFrame(h));

  const state = createGamepadPollState();
  let active = true;
  let handle = 0;

  const loop = (): void => {
    if (!active) {
      return;
    }
    try {
      pollGamepad(getGamepads, dispatch, now(), state);
    } catch {
      // A flaky/unplugging pad must never sink the frame loop or the app.
    }
    handle = raf(loop);
  };
  handle = raf(loop);

  const teardown = (): void => {
    active = false;
    caf(handle);
    if (installedTeardown === teardown) {
      installedTeardown = null;
    }
  };
  installedTeardown = teardown;
  return teardown;
}

/** True while a bridge loop is running (test/QA introspection only). */
export function isGamepadBridgeInstalled(): boolean {
  return installedTeardown !== null;
}
