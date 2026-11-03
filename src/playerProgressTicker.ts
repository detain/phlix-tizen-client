/**
 * playerProgressTicker — ONE shared 250 ms playback-position tick, typed reads.
 *
 * Review M10 cure. ChapterOverlay and SkipIntroOverlay each ran their own
 * `setInterval` over an untyped `?? currentTime ?? time ?? current_position`
 * name-guessing ladder. Both halves were wrong:
 *
 *  - The ladder was superstition: the shipped @phlix/ui player-store contract
 *    (node_modules/@phlix/ui/dist/stores/usePlayerStore.d.ts) types exactly
 *    `position: Ref<number>` and `duration: Ref<number>` (seconds). The other
 *    candidate names never existed; the fallback chain could only ever mask a
 *    rename as a silent stall instead of a visible break.
 *  - Two overlays mount concurrently on the player route (both are long-lived
 *    root apps), so the TV paid two intervals where the bus carries one.
 *
 * This module keeps the exact read law of the old ladders that actually fired
 * (position updates on `typeof p === 'number' && p >= 0`; duration on
 * `typeof d === 'number' && d > 0`) and hands subscribers `null` for "nothing
 * valid this tick" — per-component behavior is byte-identical, the plumbing is
 * single-source. The interval exists exactly while at least one subscriber is
 * attached (law-pinned: `vi.getTimerCount()` rises +1 on first mount and
 * returns to base on the last unsubscribe).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

/** The typed slice of the vendored player store this ticker reads. */
export interface PlayerProgressSource {
  /** Playback position in seconds (vendored store law). */
  position: number;
  /** Total media duration in seconds (vendored store law). */
  duration: number;
}

/**
 * Tick callback: either value is `null` when the store gave nothing usable
 * this tick (same accept-filters the per-component ladders applied).
 */
export type PlayerProgressTick = (position: number | null, duration: number | null) => void;

/** Cadence both overlays used before the merge; smooth without hot-looping a TV. */
export const PLAYER_TICK_MS = 250;

const subscribers = new Map<PlayerProgressTick, PlayerProgressSource>();
let interval: ReturnType<typeof setInterval> | null = null;

function pump(): void {
  // Snapshot first: a tick callback may unsubscribe (overlay navigating away).
  for (const [tick, store] of [...subscribers]) {
    const rawPosition: unknown = store.position;
    const rawDuration: unknown = store.duration;
    const position = typeof rawPosition === 'number' && rawPosition >= 0 ? rawPosition : null;
    const duration = typeof rawDuration === 'number' && rawDuration > 0 ? rawDuration : null;
    if (position === null && duration === null) continue;
    tick(position, duration);
  }
}

/**
 * Attach `tick` to the shared pulse, reading `store` every tick. Returns an
 * idempotent unsubscribe; the interval starts on the first subscriber and
 * clears itself on the last one.
 */
export function subscribePlayerProgress(
  store: PlayerProgressSource,
  tick: PlayerProgressTick,
): () => void {
  subscribers.set(tick, store);
  if (!interval) {
    interval = setInterval(pump, PLAYER_TICK_MS);
  }
  let detached = false;
  return () => {
    if (detached) return;
    detached = true;
    subscribers.delete(tick);
    if (subscribers.size === 0 && interval) {
      clearInterval(interval);
      interval = null;
    }
  };
}

/** Test seam only — subscriber count (0 when the shared interval is idle). */
export function playerProgressSubscriberCount(): number {
  return subscribers.size;
}
