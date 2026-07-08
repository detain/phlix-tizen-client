import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RemoteManager } from '@/remote/RemoteManager';

// The keyCode → action mapping is exercised via KeyMapping elsewhere; here we
// drive `onKeyDown` with a minimal fake event (jsdom does not reliably surface
// a synthesized `keyCode`) to assert the generic suppression hook.
function fakeKeyEvent(keyCode: number): KeyboardEvent {
  return {
    keyCode,
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
