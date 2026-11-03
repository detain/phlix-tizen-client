/**
 * playerProgressTicker law pins (review M10).
 *
 * Guards the three laws the two polling overlays now lean on: one shared
 * interval across subscribers, the legacy accept-filters (position ≥ 0,
 * duration > 0 — everything else arrives as `null`), and self-cleaning on the
 * last (idempotent) unsubscribe.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  subscribePlayerProgress,
  playerProgressSubscriberCount,
  PLAYER_TICK_MS,
  type PlayerProgressSource,
} from '@/playerProgressTicker';

function store(position = 0, duration = 0): PlayerProgressSource {
  return { position, duration };
}

describe('subscribePlayerProgress (review M10)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs ONE interval no matter how many subscribers are attached', () => {
    vi.useFakeTimers();
    const base = vi.getTimerCount();
    const a = vi.fn();
    const b = vi.fn();
    const s = store(10, 100);
    const offA = subscribePlayerProgress(s, a);
    const offB = subscribePlayerProgress(s, b);
    expect(vi.getTimerCount()).toBe(base + 1);
    expect(playerProgressSubscriberCount()).toBe(2);

    vi.advanceTimersByTime(PLAYER_TICK_MS);
    expect(a).toHaveBeenCalledWith(10, 100);
    expect(b).toHaveBeenCalledWith(10, 100);

    offA();
    offB();
    expect(vi.getTimerCount()).toBe(base); // last unsubscribe cleared it
    expect(playerProgressSubscriberCount()).toBe(0);
  });

  it('applies the legacy accept-filters: invalid values arrive as null', () => {
    vi.useFakeTimers();
    const tick = vi.fn();
    const s = store();
    const off = subscribePlayerProgress(s, tick);

    s.position = -5;
    s.duration = 0; // nothing valid → the tick stays silent (old ?? 0 no-op path)
    vi.advanceTimersByTime(PLAYER_TICK_MS);
    expect(tick).not.toHaveBeenCalled();

    s.position = 0; // 0 is a VALID position (fresh start) — duration still invalid
    vi.advanceTimersByTime(PLAYER_TICK_MS);
    expect(tick).toHaveBeenLastCalledWith(0, null);

    s.position = Number.NaN; // NaN passes typeof-number but fails >= 0
    s.duration = Number.POSITIVE_INFINITY;
    vi.advanceTimersByTime(PLAYER_TICK_MS);
    // Infinity>0 would slip the old filter too — law preserved EXACTLY as before:
    expect(tick).toHaveBeenLastCalledWith(null, Number.POSITIVE_INFINITY);

    off();
  });

  it('unsubscribe is idempotent and detaches even when a peer holds the pulse', () => {
    vi.useFakeTimers();
    const base = vi.getTimerCount();
    const a = vi.fn();
    const b = vi.fn();
    const s = store(1, 60);
    const offA = subscribePlayerProgress(s, a);
    const offB = subscribePlayerProgress(s, b);
    offA();
    offA(); // second call is inert, interval survives for B
    expect(vi.getTimerCount()).toBe(base + 1);

    vi.advanceTimersByTime(PLAYER_TICK_MS);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith(1, 60);

    offB();
    expect(vi.getTimerCount()).toBe(base);
  });
});
