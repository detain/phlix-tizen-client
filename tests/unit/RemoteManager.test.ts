import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RemoteManager } from '@/remote/RemoteManager';

// The keyCode → action mapping is exercised via KeyMapping elsewhere; here we
// drive `onKeyDown` with a minimal fake event (jsdom does not reliably surface
// a synthesized `keyCode`) to assert the generic suppression hook. An absent
// `target` means "no typing target" — the S535 digit branch treats it like
// normal focus (which is exactly what the buffer pins below rely on).
function fakeKeyEvent(keyCode: number, target?: EventTarget): KeyboardEvent {
  return {
    keyCode,
    target,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn()
  } as unknown as KeyboardEvent;
}

describe('RemoteManager.suppressPropagation', () => {
  let rm: RemoteManager;

  beforeEach(() => {
    rm = new RemoteManager();
  });
  afterEach(() => {
    rm.destroy();
  });

  it('stops propagation when the guard returns true for the mapped key', () => {
    rm.suppressPropagation = (key) => key === 'DOWN';
    const e = fakeKeyEvent(40); // 40 → DOWN
    rm.onKeyDown(e);
    expect(e.stopImmediatePropagation).toHaveBeenCalledTimes(1);
  });

  it('does not stop propagation when the guard returns false', () => {
    rm.suppressPropagation = () => false;
    const e = fakeKeyEvent(40);
    rm.onKeyDown(e);
    expect(e.stopImmediatePropagation).not.toHaveBeenCalled();
  });

  it('does not stop propagation when no guard is set (default)', () => {
    const e = fakeKeyEvent(40);
    rm.onKeyDown(e);
    expect(e.stopImmediatePropagation).not.toHaveBeenCalled();
  });

  it('passes the resolved action name to the guard', () => {
    const guard = vi.fn(() => false);
    rm.suppressPropagation = guard;
    rm.onKeyDown(fakeKeyEvent(40));
    expect(guard).toHaveBeenCalledWith('DOWN', expect.anything());
  });

  it('leaves other keys unaffected while suppressing the nav keys', () => {
    rm.suppressPropagation = (key) => key === 'UP' || key === 'DOWN';
    const down = fakeKeyEvent(40); // DOWN → suppressed
    const play = fakeKeyEvent(415); // PLAY → not suppressed
    rm.onKeyDown(down);
    rm.onKeyDown(play);
    expect(down.stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(play.stopImmediatePropagation).not.toHaveBeenCalled();
  });
});

describe('RemoteManager event system', () => {
  let rm: RemoteManager;

  beforeEach(() => {
    rm = new RemoteManager();
  });
  afterEach(() => {
    rm.destroy();
  });

  it('on() registers a listener and returns an unsubscribe function', () => {
    const handler = vi.fn();
    const unsubscribe = rm.on('action', handler);
    expect(typeof unsubscribe).toBe('function');
  });

  it('off() removes a registered listener', () => {
    const handler = vi.fn();
    rm.on('action', handler);
    rm.off('action', handler);
    rm.emit('action', { key: 'PLAY' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('emits action events to registered handlers', () => {
    const handler = vi.fn();
    rm.on('action', handler);
    rm.emit('action', { key: 'PLAY' });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ key: 'PLAY' });
  });

  it('emits keydown events with keyCode and mappedKey', () => {
    const handler = vi.fn();
    rm.on('keydown', handler);
    rm.emit('keydown', { keyCode: 415, mappedKey: 'PLAY' });
    expect(handler).toHaveBeenCalledWith({ keyCode: 415, mappedKey: 'PLAY' });
  });

  it('emits keyup events with keyCode and mappedKey', () => {
    const handler = vi.fn();
    rm.on('keyup', handler);
    rm.emit('keyup', { keyCode: 415, mappedKey: 'PLAY' });
    expect(handler).toHaveBeenCalledWith({ keyCode: 415, mappedKey: 'PLAY' });
  });

  it('off() is safe when no listeners are registered', () => {
    const handler = vi.fn();
    expect(() => rm.off('action', handler)).not.toThrow();
  });

  it('emit() is safe when no listeners are registered', () => {
    expect(() => rm.emit('action', { key: 'PLAY' })).not.toThrow();
    expect(() => rm.emit('keydown', { keyCode: 415, mappedKey: 'PLAY' })).not.toThrow();
    expect(() => rm.emit('keyup', { keyCode: 415, mappedKey: 'PLAY' })).not.toThrow();
  });

  it('multiple handlers are called in order of registration', () => {
    const callOrder: string[] = [];
    rm.on('action', () => callOrder.push('first'));
    rm.on('action', () => callOrder.push('second'));
    rm.on('action', () => callOrder.push('third'));
    rm.emit('action', { key: 'PLAY' });
    expect(callOrder).toEqual(['first', 'second', 'third']);
  });

  it('unsubscribe removes only the specific handler', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const unsubscribe1 = rm.on('action', handler1);
    rm.on('action', handler2);
    unsubscribe1();
    rm.emit('action', { key: 'PLAY' });
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('onAction is a convenience wrapper for on("action", callback)', () => {
    const handler = vi.fn();
    rm.onAction(handler);
    rm.emit('action', { key: 'PLAY' });
    expect(handler).toHaveBeenCalledWith({ key: 'PLAY' });
  });
});

describe('RemoteManager key handling', () => {
  let rm: RemoteManager;

  beforeEach(() => {
    rm = new RemoteManager();
  });
  afterEach(() => {
    rm.destroy();
  });

  it('does not process events when disabled', () => {
    rm.setEnabled(false);
    const handler = vi.fn();
    rm.on('action', handler);
    rm.onKeyDown(fakeKeyEvent(415)); // PLAY
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not emit keydown/keyup when disabled', () => {
    rm.setEnabled(false);
    const keydownHandler = vi.fn();
    const keyupHandler = vi.fn();
    rm.on('keydown', keydownHandler);
    rm.on('keyup', keyupHandler);
    rm.onKeyDown(fakeKeyEvent(40));
    rm.onKeyUp(fakeKeyEvent(40));
    expect(keydownHandler).not.toHaveBeenCalled();
    expect(keyupHandler).not.toHaveBeenCalled();
  });

  it('calls preventDefault for the held-repeat seek keys (FF/REW) - three times (repeatable + immediate + handled)', () => {
    // M-TIZEN-09: FF/REW are immediate AND repeatable now — the branch hits
    // stack up: repeatable arm (timer), immediate arm (tap emit), handled arm.
    const ffEvent = fakeKeyEvent(417); // FAST_FORWARD
    rm.onKeyDown(ffEvent);
    expect(ffEvent.preventDefault).toHaveBeenCalledTimes(3);

    const rewEvent = fakeKeyEvent(412); // REWIND
    rm.onKeyDown(rewEvent);
    expect(rewEvent.preventDefault).toHaveBeenCalledTimes(3);
  });

  it('calls preventDefault for immediate keys (PLAY/PAUSE/STOP/BACK/HOME) - twice (immediate + handled)', () => {
    for (const keyCode of [415, 413, 19, 10009, 36]) {
      const e = fakeKeyEvent(keyCode);
      rm.onKeyDown(e);
      // Called once for immediate (line 93) and once for handled (line 100)
      expect(e.preventDefault).toHaveBeenCalledTimes(2);
    }
  });

  it('calls preventDefault for the M-TIZEN-09 taps (NEXT/VOLUME) - twice (immediate + handled)', () => {
    // Volume/NEXT left the repeatable set (no repeat timer arm) and joined
    // immediate: exactly the two preventDefault hits every discrete tap gets.
    for (const keyCode of [425, 1028, 1029]) {
      const e = fakeKeyEvent(keyCode);
      rm.onKeyDown(e);
      expect(e.preventDefault).toHaveBeenCalledTimes(2);
    }
  });

  it('does not call preventDefault for unhandled keys (arrows/ENTER/retired codes)', () => {
    // M-TIZEN-09: RETIRED codes (403 RED, 10282 MENU, 79 OPTIONS) now resolve
    // to UNKNOWN_* and pass through unhandled — the honest system behavior
    // the review's cure demands (was: swallowed + a caption toast).
    for (const keyCode of [37, 38, 39, 40, 13, 403, 10282, 79]) {
      const e = fakeKeyEvent(keyCode);
      rm.onKeyDown(e);
      expect(e.preventDefault).not.toHaveBeenCalled();
    }
  });

  it('stops key repeat timer when disabled', () => {
    rm.setEnabled(false);
    // Should not throw even if there was an active repeat
    expect(() => rm.setEnabled(false)).not.toThrow();
  });
});

describe('RemoteManager key repeat', () => {
  // Note: These tests use vi.useFakeTimers to control async timer behavior.
  // The timers must be set up BEFORE the RemoteManager instance is created.

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits action immediately for immediate keys (PLAY)', () => {
    const rm = new RemoteManager();
    const handler = vi.fn();
    rm.onAction(handler);
    rm.onKeyDown(fakeKeyEvent(415)); // PLAY (immediate key)
    expect(handler).toHaveBeenCalledWith({ key: 'PLAY' });
    rm.destroy();
  });

  it('FAST_FORWARD/REWIND tap EMITS ONE non-repeat action on keydown (M-TIZEN-09)', () => {
    // Parent law (the bug): repeatable-only ⇒ a single press emitted nothing
    // (the review's "single-tap is dead"). New law: the press itself steps —
    // the bridge's designed ±10 s arm finally has an emitter on the key path.
    const rm = new RemoteManager();
    const handler = vi.fn();
    rm.onAction(handler);
    rm.onKeyDown(fakeKeyEvent(417)); // FAST_FORWARD
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ key: 'FAST_FORWARD' }); // no repeat stamp
    handler.mockClear();
    rm.onKeyDown(fakeKeyEvent(412)); // REWIND
    expect(handler).toHaveBeenCalledWith({ key: 'REWIND' });
    rm.destroy();
  });

  it('a tap (keydown + keyup inside the delay) emits EXACTLY ONE step — no hold action', () => {
    const rm = new RemoteManager();
    const handler = vi.fn();
    rm.onAction(handler);
    rm.onKeyDown(fakeKeyEvent(417));
    vi.advanceTimersByTime(300); // < keyRepeatDelay (500)
    rm.onKeyUp(fakeKeyEvent(417));
    vi.advanceTimersByTime(2000);
    expect(handler.mock.calls.map((c) => c[0])).toEqual([{ key: 'FAST_FORWARD' }]);
    rm.destroy();
  });

  it('NEXT/VOLUME_UP/VOLUME_DOWN/MUTE emit immediately (M-TIZEN-09 taps)', () => {
    const rm = new RemoteManager();
    const handler = vi.fn();
    rm.onAction(handler);
    for (const keyCode of [425, 1028, 1029, 1025]) {
      rm.onKeyDown(fakeKeyEvent(keyCode));
    }
    vi.advanceTimersByTime(3000); // nothing extra from any repeat machinery
    expect(handler.mock.calls.map((c) => c[0])).toEqual([
      { key: 'NEXT' },
      { key: 'VOLUME_UP' },
      { key: 'VOLUME_DOWN' },
      { key: 'MUTE' }
    ]);
    rm.destroy();
  });

  it('RETIRED vocabulary emits nothing and is not preventDefaulted (dead keys absent)', () => {
    // 424 PREVIOUS / 403 RED / 10282 MENU / 79 OPTIONS were removed from the
    // KEY_MAP (dead mapping = lie in code). The codes resolve to UNKNOWN_*
    // and pass through exactly like the arrows do.
    const rm = new RemoteManager();
    const handler = vi.fn();
    rm.onAction(handler);
    for (const keyCode of [424, 403, 10282, 79]) {
      const e = fakeKeyEvent(keyCode);
      rm.onKeyDown(e);
      expect(e.preventDefault).not.toHaveBeenCalled();
    }
    vi.advanceTimersByTime(3000);
    expect(handler).not.toHaveBeenCalled();
    rm.destroy();
  });

  it('schedules key repeat for the held seek keys - first step after delay plus interval', () => {
    const rm = new RemoteManager();
    const handler = vi.fn();
    rm.onAction(handler);
    rm.onKeyDown(fakeKeyEvent(417)); // FAST_FORWARD — tap step fires immediately…
    expect(handler).toHaveBeenCalledTimes(1);

    // …the HOLD cadence (M-TIZEN-09): keyRepeatDelay 500 + interval 500 ⇒
    // first repeat at 1000 ms. Parent was 500+100: a 30 s step every 100 ms
    // (≈300× timeline) — the review's "hold is a teleport". Throttled to 2
    // steps/s ≈ 60×, still relative seekBy deltas, never a target jump.
    vi.advanceTimersByTime(900);
    expect(handler).toHaveBeenCalledTimes(1); // not yet — pin against the old 600 ms cadence
    vi.advanceTimersByTime(150);
    expect(handler).toHaveBeenLastCalledWith({ key: 'FAST_FORWARD', repeat: true });
    rm.destroy();
  });

  it('stops key repeat on key up', () => {
    const rm = new RemoteManager();
    const handler = vi.fn();
    rm.onAction(handler);
    rm.onKeyDown(fakeKeyEvent(417)); // FAST_FORWARD
    vi.advanceTimersByTime(1050); // past the first HOLD repeat
    rm.onKeyUp(fakeKeyEvent(417));
    const countBefore = handler.mock.calls.length;
    vi.advanceTimersByTime(1000); // more time
    const countAfter = handler.mock.calls.length;
    // No new calls after key up
    expect(countAfter).toBe(countBefore);
    rm.destroy();
  });

  it('continues repeating at intervals', () => {
    const rm = new RemoteManager();
    const handler = vi.fn();
    rm.onAction(handler);
    rm.onKeyDown(fakeKeyEvent(417)); // FAST_FORWARD (tap)
    vi.advanceTimersByTime(1050); // first HOLD repeat

    const countAfterFirst = handler.mock.calls.length;
    vi.advanceTimersByTime(500); // past keyRepeatInterval (500 ms)
    const countAfterSecond = handler.mock.calls.length;
    expect(countAfterSecond).toBe(countAfterFirst + 1);
    // …and stays at that cadence — not the parent's 100 ms machine-gun.
    vi.advanceTimersByTime(1500);
    expect(handler.mock.calls.length).toBe(countAfterSecond + 3);
    rm.destroy();
  });
});

describe('RemoteManager lifecycle', () => {
  it('init does not throw when document is undefined', () => {
    const rm = new RemoteManager();
    // Manually call init in an environment without document
    const originalDocument = globalThis.document;
    // @ts-expect-error - testing missing document
    delete globalThis.document;
    expect(() => rm.init()).not.toThrow();
    globalThis.document = originalDocument;
    rm.destroy();
  });

  it('destroy removes event listeners and clears state', () => {
    const rm = new RemoteManager();
    const actionHandler = vi.fn();
    const keydownHandler = vi.fn();
    rm.onAction(actionHandler);
    rm.on('keydown', keydownHandler);
    rm.destroy();
    // After destroy, emitting should not call handlers
    rm.emit('action', { key: 'PLAY' });
    rm.emit('keydown', { keyCode: 415, mappedKey: 'PLAY' });
    expect(actionHandler).not.toHaveBeenCalled();
    expect(keydownHandler).not.toHaveBeenCalled();
  });

  it('destroy is idempotent (safe to call multiple times)', () => {
    const rm = new RemoteManager();
    expect(() => {
      rm.destroy();
      rm.destroy();
      rm.destroy();
    }).not.toThrow();
  });
});

// S535 (AD-22) — the digit channel goes LIVE: the dead DIGIT_* passthrough is
// replaced by the shared digit-commit buffer. AC#2 pins: digits on normal focus
// yield ONE DIGIT_COMMIT action on the existing `action` channel (joined and
// single cases), while typing-target digits behave EXACTLY like the old
// passthrough (nothing but keydown — the "1984" law, zero preventDefault).
describe('RemoteManager digit-commit buffer (S535)', () => {
  let rm: RemoteManager;

  beforeEach(() => {
    vi.useFakeTimers();
    rm = new RemoteManager();
  });
  afterEach(() => {
    rm.destroy();
    vi.useRealTimers();
  });

  function actions(handler: ReturnType<typeof vi.fn>): Array<Record<string, unknown>> {
    return handler.mock.calls.map((call) => call[0] as Record<string, unknown>);
  }

  it('a lone digit on normal focus commits as ONE {key: DIGIT_COMMIT, value} action', () => {
    const handler = vi.fn();
    rm.on('action', handler);

    rm.onKeyDown(fakeKeyEvent(55)); // 55 → DIGIT_7 ('7')
    expect(handler).not.toHaveBeenCalled(); // buffered, not immediate

    vi.advanceTimersByTime(2000); // findings' 2 s window
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ key: 'DIGIT_COMMIT', value: '7' });
  });

  it('"1-2-3 fast" joins into a SINGLE commit — "1 2 3" slow would be three', () => {
    const handler = vi.fn();
    rm.on('action', handler);

    rm.onKeyDown(fakeKeyEvent(49)); // '1'
    rm.onKeyDown(fakeKeyEvent(50)); // '2'
    rm.onKeyDown(fakeKeyEvent(51)); // '3'
    vi.advanceTimersByTime(2000);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ key: 'DIGIT_COMMIT', value: '123' });

    // Slow entry: each digit arrives after the window → three separate commits.
    handler.mockClear();
    for (const keyCode of [49, 50, 51]) {
      rm.onKeyDown(fakeKeyEvent(keyCode));
      vi.advanceTimersByTime(2000);
    }
    expect(actions(handler)).toEqual([
      { key: 'DIGIT_COMMIT', value: '1' },
      { key: 'DIGIT_COMMIT', value: '2' },
      { key: 'DIGIT_COMMIT', value: '3' }
    ]);
  });

  it('keeps emitting keydown for digits and never preventDefaults them (passthrough preserved)', () => {
    const keydown = vi.fn();
    rm.on('keydown', keydown);

    const e = fakeKeyEvent(52); // DIGIT_4
    rm.onKeyDown(e);
    expect(keydown).toHaveBeenCalledWith({ keyCode: 52, mappedKey: 'DIGIT_4' });
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('HARD LAW — typing-target digits stay byte-identical passthrough ("1984")', () => {
    const input = document.createElement('input');
    input.type = 'search';
    const handler = vi.fn();
    rm.on('action', handler);

    const events = [49, 50, 56, 52].map((keyCode) => {
      const e = fakeKeyEvent(keyCode, input); // 1, 9, 8, 4
      rm.onKeyDown(e);
      return e;
    });
    vi.advanceTimersByTime(10_000);

    expect(handler).not.toHaveBeenCalled(); // no buffer, no commit while typing
    for (const e of events) expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('leaving the typing target resumes buffering: same instance, one buffer', () => {
    const input = document.createElement('input');
    const handler = vi.fn();
    rm.on('action', handler);

    rm.onKeyDown(fakeKeyEvent(49, input)); // typed — dropped like today
    rm.onKeyDown(fakeKeyEvent(53)); // normal focus — buffered
    vi.advanceTimersByTime(2000);
    expect(actions(handler)).toEqual([{ key: 'DIGIT_COMMIT', value: '5' }]);
  });

  it('pressDigit is the shared entry voice numerics use — same buffer, same commit', () => {
    const handler = vi.fn();
    rm.on('action', handler);

    // Voice seam hands over DIGIT_* action names (S531 → S535 same-handler wiring).
    rm.pressDigit('DIGIT_6');
    rm.pressDigit('DIGIT_5');
    // Key-routed digit joins with the voice digits — ONE queue proves it: the
    // very same buffer instance drains '65' plus the key's '4' as ONE commit.
    rm.onKeyDown(fakeKeyEvent(52)); // DIGIT_4
    vi.advanceTimersByTime(2000);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ key: 'DIGIT_COMMIT', value: '654' });
  });

  it('pressDigit refuses non-digit action names without touching the queue', () => {
    const handler = vi.fn();
    rm.on('action', handler);

    rm.pressDigit('PLAY');
    rm.pressDigit('DIGIT_COMMIT');
    rm.pressDigit('UNKNOWN_9');
    vi.advanceTimersByTime(5000);
    expect(handler).not.toHaveBeenCalled();
  });

  it('disabling drops a pending burst WITHOUT emitting (same posture as key repeat)', () => {
    const handler = vi.fn();
    rm.on('action', handler);

    rm.onKeyDown(fakeKeyEvent(49));
    rm.setEnabled(false);
    vi.advanceTimersByTime(5000);
    expect(handler).not.toHaveBeenCalled();

    rm.setEnabled(true);
    rm.onKeyDown(fakeKeyEvent(50));
    vi.advanceTimersByTime(2000);
    expect(actions(handler)).toEqual([{ key: 'DIGIT_COMMIT', value: '2' }]);
  });

  it('destroy drops a pending burst WITHOUT a ghost commit', () => {
    const handler = vi.fn();
    rm.on('action', handler);

    rm.onKeyDown(fakeKeyEvent(57));
    rm.destroy();
    vi.advanceTimersByTime(5000);
    expect(handler).not.toHaveBeenCalled();
  });

  it('keyup of a digit changes nothing — the one-shot still drains the burst', () => {
    const handler = vi.fn();
    rm.on('action', handler);

    rm.onKeyDown(fakeKeyEvent(49));
    rm.onKeyUp(fakeKeyEvent(49));
    rm.onKeyDown(fakeKeyEvent(50));
    rm.onKeyUp(fakeKeyEvent(50));
    vi.advanceTimersByTime(2000);
    expect(actions(handler)).toEqual([{ key: 'DIGIT_COMMIT', value: '12' }]);
  });
});

describe('RemoteManager enabled state', () => {
  let rm: RemoteManager;

  beforeEach(() => {
    vi.useFakeTimers();
    rm = new RemoteManager();
  });
  afterEach(() => {
    rm.destroy();
    vi.useRealTimers();
  });

  it('starts in enabled state', () => {
    expect(rm.enabled).toBe(true);
  });

  it('setEnabled(false) disables processing', () => {
    rm.setEnabled(false);
    expect(rm.enabled).toBe(false);
  });

  it('setEnabled(true) re-enables processing', () => {
    rm.setEnabled(false);
    rm.setEnabled(true);
    expect(rm.enabled).toBe(true);
  });

  it('disabling stops any active key repeat', () => {
    const handler = vi.fn();
    rm.onAction(handler);
    rm.onKeyDown(fakeKeyEvent(417)); // FAST_FORWARD (tap step)
    rm.setEnabled(false);
    vi.advanceTimersByTime(2000); // well past delay + interval (M-TIZEN-09 cadence)
    const callsAfterDisable = handler.mock.calls.length;
    vi.advanceTimersByTime(2000);
    const callsAfterMoreTime = handler.mock.calls.length;
    expect(callsAfterMoreTime).toBe(callsAfterDisable);
  });
});
