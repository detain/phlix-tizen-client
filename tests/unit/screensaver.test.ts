/**
 * screensaver.test — S523 AD-21, the pure idle-policy decision table.
 *
 * AC-3 pins the full matrix (idle × playing × paused × key-reset × boundary)
 * with plain numbers — no DOM, no timers — plus the parse-don't-validate
 * storage override. The overlay half is mounted-tested in
 * ScreenSaverOverlay.test.ts; the privilege verdict (AC-1) is manifest-pinned
 * there too (zero config.xml change is additionally proven by the untouched
 * git diff of app/ + package/config.xml in the PR).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect } from 'vitest';
import {
  IDLE_BODY_CLASS,
  IDLE_TIMEOUT_KEY,
  IDLE_TIMEOUT_MS,
  resolveIdleTimeoutMs,
  shouldEngageScreenSaver,
} from '@/screensaver';

describe('resolveIdleTimeoutMs — parse, do not validate (Law 2)', () => {
  it('absent key → the 180 s jellyfin-convention default', () => {
    expect(resolveIdleTimeoutMs({ getItem: () => null })).toBe(IDLE_TIMEOUT_MS);
    expect(IDLE_TIMEOUT_MS).toBe(180_000);
  });

  it('positive integer override wins', () => {
    const storage = { getItem: (k: string) => (k === IDLE_TIMEOUT_KEY ? '30000' : null) };
    expect(resolveIdleTimeoutMs(storage)).toBe(30_000);
  });

  it('garbage / empty / fractional / non-positive all fall back to the default', () => {
    for (const raw of ['', 'abc', '0', '-5', '2.5', 'NaN', 'Infinity', '  ', '12x']) {
      const storage = { getItem: (k: string) => (k === IDLE_TIMEOUT_KEY ? raw : null) };
      expect(resolveIdleTimeoutMs(storage), `raw ${JSON.stringify(raw)}`).toBe(IDLE_TIMEOUT_MS);
    }
  });
});

describe('shouldEngageScreenSaver — the WHOLE policy, pinned (AC-3 decision table)', () => {
  const T0 = 1_000_000;

  it('NOT playing + window NOT elapsed → stays off', () => {
    expect(
      shouldEngageScreenSaver({ now: T0 + 179_999, lastActivityAt: T0, timeoutMs: 180_000, isPlaying: false }),
    ).toBe(false);
  });

  it('NOT playing + window fully elapsed → engages (>= boundary)', () => {
    expect(
      shouldEngageScreenSaver({ now: T0 + 180_000, lastActivityAt: T0, timeoutMs: 180_000, isPlaying: false }),
    ).toBe(true);
  });

  it('PLAYING + window long elapsed → NEVER engages (playback veto)', () => {
    expect(
      shouldEngageScreenSaver({ now: T0 + 10 * 60_000, lastActivityAt: T0, timeoutMs: 180_000, isPlaying: true }),
    ).toBe(false);
  });

  it('PAUSED (isPlaying false) + window elapsed → engages (browse/pause is eligible)', () => {
    expect(
      shouldEngageScreenSaver({ now: T0 + 200_000, lastActivityAt: T0, timeoutMs: 180_000, isPlaying: false }),
    ).toBe(true);
  });

  it('key reset (lastActivityAt = now) → does not engage even past the old window', () => {
    // Idle for an hour, then a routed key stamps now; the next decision at
    // now + 1 s must be false — the window was re-armed by the key.
    expect(
      shouldEngageScreenSaver({ now: T0 + 3_600_001, lastActivityAt: T0 + 3_600_000, timeoutMs: 180_000, isPlaying: false }),
    ).toBe(false);
  });

  it('custom shorter window is honored by the same function', () => {
    expect(
      shouldEngageScreenSaver({ now: T0 + 5_000, lastActivityAt: T0, timeoutMs: 5_000, isPlaying: false }),
    ).toBe(true);
  });
});

describe('policy constants (ritual pins)', () => {
  it('the body class is the jellyfin-convention `screensaver-active`', () => {
    expect(IDLE_BODY_CLASS).toBe('screensaver-active');
  });
});
