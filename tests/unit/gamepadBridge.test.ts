/**
 * gamepadBridge (S522 / AD-20) — the gamepad→synthetic-keyboard translation.
 *
 * jsdom has no Gamepad API and no real rAF, so every case drives the PURE
 * `pollGamepad` with an injected fake pad reader + a recording dispatcher + an
 * explicit `now`. The impure install edge is exercised with a fake rAF that only
 * schedules when we ask it to. One integration case proves the synthesized
 * `document` events actually reach the REAL `RemoteManager` seam.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  pollGamepad,
  createGamepadPollState,
  installGamepadBridge,
  isGamepadBridgeInstalled,
  dispatchDomKey,
  GAMEPAD_DEADZONE,
  GAMEPAD_INITIAL_REPEAT_MS,
  GAMEPAD_SUBSEQUENT_REPEAT_MS,
  type GamepadDispatch,
  type GamepadLike,
  type KeySpec,
} from '@/remote/gamepadBridge';
import { RemoteManager } from '@/remote/RemoteManager';

const REPO = path.resolve(__dirname, '..', '..');

interface Emitted extends KeySpec {
  kind: 'keydown' | 'keyup';
}

function recorder(): { emit: GamepadDispatch; events: Emitted[] } {
  const events: Emitted[] = [];
  const emit: GamepadDispatch = (kind, spec) => {
    events.push({ kind, ...spec });
  };
  return { emit, events };
}

function pad(input: {
  up?: boolean;
  down?: boolean;
  left?: boolean;
  right?: boolean;
  a?: boolean;
  b?: boolean;
  axes?: number[];
  connected?: boolean;
}): GamepadLike {
  const buttons = [
    { pressed: Boolean(input.a) }, // 0 = A
    { pressed: Boolean(input.b) }, // 1 = B
    ...Array.from({ length: 10 }, () => ({ pressed: false })), // 2..11 filler
    { pressed: Boolean(input.up) }, // 12 = D-pad up
    { pressed: Boolean(input.down) }, // 13 = D-pad down
    { pressed: Boolean(input.left) }, // 14 = D-pad left
    { pressed: Boolean(input.right) }, // 15 = D-pad right
  ];
  return { connected: input.connected !== false, buttons, axes: input.axes ?? [0, 0] };
}

function reader(...pads: Array<GamepadLike | null>) {
  return () => pads;
}

describe('pollGamepad — D-pad + Enter/Back', () => {
  it('emits ArrowUp keydown on a rising D-pad press and keyup on release', () => {
    const { emit, events } = recorder();
    const state = createGamepadPollState();

    pollGamepad(reader(pad({ up: true })), emit, 1000, state);
    pollGamepad(reader(pad({ up: false })), emit, 2000, state);

    expect(events).toEqual([
      { kind: 'keydown', keyCode: 38, key: 'ArrowUp' },
      { kind: 'keyup', keyCode: 38, key: 'ArrowUp' },
    ]);
  });

  it('A fires exactly one Enter keydown while held (no auto-repeat) then a keyup', () => {
    const { emit, events } = recorder();
    const state = createGamepadPollState();

    // Held across several frames at widening times — Enter must never repeat.
    pollGamepad(reader(pad({ a: true })), emit, 0, state);
    pollGamepad(reader(pad({ a: true })), emit, 5000, state);
    pollGamepad(reader(pad({ a: true })), emit, 9000, state);
    pollGamepad(reader(pad({ a: false })), emit, 10000, state);

    expect(events).toEqual([
      { kind: 'keydown', keyCode: 13, key: 'Enter' },
      { kind: 'keyup', keyCode: 13, key: 'Enter' },
    ]);
  });

  it('B emits the Samsung BACK keyCode (10009) on keydown/keyup', () => {
    const { emit, events } = recorder();
    const state = createGamepadPollState();

    pollGamepad(reader(pad({ b: true })), emit, 0, state);
    pollGamepad(reader(pad({ b: false })), emit, 50, state);

    expect(events).toEqual([
      { kind: 'keydown', keyCode: 10009, key: 'Backspace' },
      { kind: 'keyup', keyCode: 10009, key: 'Backspace' },
    ]);
  });

  it('does nothing when no pad is connected', () => {
    const { emit, events } = recorder();
    const state = createGamepadPollState();

    pollGamepad(reader(pad({ up: true, connected: false })), emit, 0, state);
    pollGamepad(() => [null], emit, 10, state);

    expect(events).toEqual([]);
  });
});

describe('pollGamepad — analog stick deadzone + dominant axis', () => {
  it('ignores stick motion inside the deadzone and fires only once past it', () => {
    const below = recorder();
    const state1 = createGamepadPollState();
    pollGamepad(reader(pad({ axes: [GAMEPAD_DEADZONE - 0.06, 0] })), below.emit, 0, state1);
    expect(below.events.filter((e) => e.key === 'ArrowRight')).toEqual([]);

    const past = recorder();
    const state2 = createGamepadPollState();
    pollGamepad(reader(pad({ axes: [0.9, 0] })), past.emit, 0, state2);
    expect(past.events).toEqual([{ kind: 'keydown', keyCode: 39, key: 'ArrowRight' }]);
  });

  it('picks the DOMINANT axis when pushed diagonally (never two opposing arrows)', () => {
    const { emit, events } = recorder();
    const state = createGamepadPollState();
    // Strong right (0.9), mild down (0.3): only ArrowRight.
    pollGamepad(reader(pad({ axes: [0.9, 0.3] })), emit, 0, state);
    expect(events.map((e) => e.key)).toEqual(['ArrowRight']);

    const down = recorder();
    const state2 = createGamepadPollState();
    // Mild right (0.3), strong down (0.9): only ArrowDown.
    pollGamepad(reader(pad({ axes: [0.3, 0.9] })), down.emit, 0, state2);
    expect(down.events.map((e) => e.key)).toEqual(['ArrowDown']);
  });

  it('sticks with a negative Y up / negative X left', () => {
    const up = recorder();
    pollGamepad(reader(pad({ axes: [0, -0.8] })), up.emit, 0, createGamepadPollState());
    expect(up.events[0]?.key).toBe('ArrowUp');

    const left = recorder();
    pollGamepad(reader(pad({ axes: [-0.8, 0] })), left.emit, 0, createGamepadPollState());
    expect(left.events[0]?.key).toBe('ArrowLeft');
  });
});

describe('pollGamepad — hold-to-repeat cadence (400 initial / 150 subsequent)', () => {
  it('fires at press, first repeat after the initial delay, then every interval, and stops on release', () => {
    const { emit, events } = recorder();
    const state = createGamepadPollState();
    const held = reader(pad({ right: true }));
    const keydowns = () => events.filter((e) => e.kind === 'keydown' && e.key === 'ArrowRight');

    pollGamepad(held, emit, 0, state); // press → keydown #1
    expect(keydowns()).toHaveLength(1);

    pollGamepad(held, emit, GAMEPAD_INITIAL_REPEAT_MS - 1, state); // 399ms → still one
    expect(keydowns()).toHaveLength(1);

    pollGamepad(held, emit, GAMEPAD_INITIAL_REPEAT_MS, state); // 400ms → repeat #2
    expect(keydowns()).toHaveLength(2);

    const afterFirstRepeat = GAMEPAD_INITIAL_REPEAT_MS;
    pollGamepad(held, emit, afterFirstRepeat + GAMEPAD_SUBSEQUENT_REPEAT_MS, state); // 550 → #3
    expect(keydowns()).toHaveLength(3);

    // nextRepeatAt is now 550 + 150 = 700. One ms short must NOT fire…
    pollGamepad(held, emit, afterFirstRepeat + GAMEPAD_SUBSEQUENT_REPEAT_MS + 140, state); // 690 → still #3
    expect(keydowns()).toHaveLength(3);
    // …but the moment it is due it does, once:
    pollGamepad(held, emit, afterFirstRepeat + GAMEPAD_SUBSEQUENT_REPEAT_MS + 150, state); // 700 → #4
    expect(keydowns()).toHaveLength(4);
    pollGamepad(held, emit, afterFirstRepeat + GAMEPAD_SUBSEQUENT_REPEAT_MS + 150, state); // same frame → no double-fire
    expect(keydowns()).toHaveLength(4);

    pollGamepad(reader(pad({ right: false })), emit, 900, state); // release → keyup
    expect(events.some((e) => e.kind === 'keyup' && e.key === 'ArrowRight')).toBe(true);
    const beforeStop = keydowns().length;
    pollGamepad(reader(pad({ right: false })), emit, 2000, state); // held off → no more keydowns
    expect(keydowns()).toHaveLength(beforeStop);
  });
});

describe('dispatchDomKey — the real DOM edge reaches the real RemoteManager seam', () => {
  afterEach(() => {
    // Nothing to clean here; RemoteManager instances are destroyed in-test.
  });

  it('a synthesized BACK keydown makes RemoteManager emit the immediate BACK action', () => {
    const rm = new RemoteManager();
    const seen: string[] = [];
    rm.onAction((a) => seen.push(a.key));
    dispatchDomKey('keydown', { keyCode: 10009, key: 'Backspace' });
    expect(seen).toEqual(['BACK']);
    rm.destroy();
  });

  it('a synthesized Enter keydown reaches RemoteManager as a keydown (not suppressed/preventDefaulted)', () => {
    const rm = new RemoteManager();
    const keys: Array<{ keyCode: number; mappedKey: string }> = [];
    rm.on('keydown', (d) => {
      if ('keyCode' in d) keys.push({ keyCode: d.keyCode, mappedKey: d.mappedKey });
    });
    dispatchDomKey('keydown', { keyCode: 13, key: 'Enter' });
    expect(keys).toContainEqual({ keyCode: 13, mappedKey: 'ENTER' });
    // Enter is NOT an immediate action → RemoteManager must not emit an action for it.
    const actions: string[] = [];
    rm.onAction((a) => actions.push(a.key));
    dispatchDomKey('keydown', { keyCode: 13, key: 'Enter' });
    expect(actions).toEqual([]);
    rm.destroy();
  });
});

describe('installGamepadBridge — lifecycle, idempotence, absent-API no-op', () => {
  afterEach(() => {
    // Ensure the module singleton never leaks a live loop into the next file/test.
    if (isGamepadBridgeInstalled()) {
      installGamepadBridge({ getGamepads: () => [], requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} })();
    }
  });

  it('is idempotent: a second install returns the SAME teardown and starts no extra loop', () => {
    let rafCount = 0;
    let cancelled = 0;
    const overrides = {
      getGamepads: reader(),
      dispatch: () => {},
      now: () => 0,
      requestAnimationFrame: () => {
        rafCount += 1;
        return rafCount;
      },
      cancelAnimationFrame: () => {
        cancelled += 1;
      },
    };
    const t1 = installGamepadBridge(overrides);
    const t2 = installGamepadBridge(overrides);
    expect(t2).toBe(t1);
    expect(rafCount).toBe(1);

    t1();
    expect(cancelled).toBe(1);
    expect(isGamepadBridgeInstalled()).toBe(false);
  });

  it('a throwing getGamepads is swallowed and the frame loop keeps scheduling', () => {
    let frames = 0;
    let cb: (() => void) | null = null;
    const teardown = installGamepadBridge({
      getGamepads: () => {
        throw new Error('mid-unplug');
      },
      dispatch: () => {},
      now: () => 0,
      requestAnimationFrame: (fn) => {
        frames += 1;
        cb = fn;
        return frames;
      },
      cancelAnimationFrame: () => {},
    });

    // The initial schedule already ran (frames === 1). Drive the loop manually:
    // the first body must NOT throw out of the rAF callback, and must re-schedule.
    expect(frames).toBe(1);
    expect(() => cb?.()).not.toThrow();
    expect(frames).toBe(2);
    teardown();
  });

  it('with no Gamepad API present it installs NOTHING and boot stays byte-identical', () => {
    // No override reader + a globalThis with no navigator.getGamepads (jsdom).
    let rafCount = 0;
    const teardown = installGamepadBridge({
      // omit getGamepads so resolveGamepadReader falls back to the environment;
      // jsdom has none → silent no-op path.
      dispatch: () => {},
      now: () => 0,
      requestAnimationFrame: () => {
        rafCount += 1;
        return 1;
      },
      cancelAnimationFrame: () => {},
    });
    expect(rafCount).toBe(0);
    expect(isGamepadBridgeInstalled()).toBe(false);
    expect(() => teardown()).not.toThrow();
  });
});

describe('gamepadBridge — focus-safe by construction (no focus/DOM mutation)', () => {
  it('the source calls no focus/blur/class/style/setAttribute APIs', () => {
    const src = readFileSync(path.join(REPO, 'src', 'remote', 'gamepadBridge.ts'), 'utf8');
    // Strip the doc comment block from the top so the honest posture prose ("NO
    // focus()", "never calls focus") cannot itself trip the grep — scan the CODE.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const banned of ['.focus(', '.blur(', '.setAttribute(', '.classList', '.style.', 'appendChild', 'removeChild', '.click(']) {
      expect(code, `expected no ${banned} in gamepadBridge code`).not.toContain(banned);
    }
    // dispatchEvent is the ONE sanctioned interaction and must still be present.
    expect(code).toContain('dispatchEvent');
  });
});
