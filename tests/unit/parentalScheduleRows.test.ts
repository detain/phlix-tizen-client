/**
 * RT-054 (review tizen__exploiter #5) — schedule rows from the wire are
 * parsed, not trusted, before the parental-controls page renders them.
 *
 * `loadSchedules()` used to cast `data.schedules` straight into
 * `AccessSchedule[]` with only a top-level `?? []`; the server DTO can carry
 * `null` into any column (an unset time window is literally NULL in the
 * row), and the render path then threw `TypeError: Cannot read properties of
 * null (reading 'split')` inside `formatTime` / `(reading 'length')` inside
 * `formatDays` — one poison row blanked the whole profile's control panel.
 *
 * The cure is the estate's reject-poison-per-row idiom (mirrors `saneMarker`
 * in SkipIntroOverlay.vue and the S234 boundary parsers): a row is rendered
 * ONLY when every field it will dereference is of its declared type, and a
 * rejected row is dropped while its healthy siblings survive. Dropping is
 * the SAFE direction for parental controls on purpose — schedules declare
 * the windows in which a profile MAY stream, so an unparseable window is
 * never widened into a partial guess (a corrupt day list would silently
 * change which days the child can watch); the parent re-creates the row.
 *
 * The module is pure (zero Vue, zero network) so the boundary contract pins
 * in isolation; ParentalControlsWireShape.test.ts carries the one mount-level
 * proof that a mixed list renders the healthy row and not the blank panel.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect } from 'vitest';
import { normalizeScheduleRows } from '@/parentalScheduleRows';
import type { AccessSchedule } from '@phlix/contracts';

const VALID: AccessSchedule = {
  id: 7,
  profileId: 'prof-1',
  name: 'Weekday window',
  start_time: '09:00',
  end_time: '17:00',
  days_of_week: ['mon', 'tue'],
  is_active: true,
};

describe('normalizeScheduleRows — RT-054 wire-boundary parse', () => {
  it('passes a healthy row through unchanged', () => {
    expect(normalizeScheduleRows([VALID])).toEqual([VALID]);
  });

  it('accepts both profile-key spellings: contract `profileId` and the server wire `profile_id`', () => {
    const camel = { ...VALID };
    const snake = { ...VALID, profileId: undefined, profile_id: 'prof-2' } as unknown as AccessSchedule;
    const rows = normalizeScheduleRows([camel, snake]);
    expect(rows.map((r) => r.profileId)).toEqual(['prof-1', 'prof-2']);
  });

  it('a non-array body yields no rows (null/undefined/object all refuse)', () => {
    expect(normalizeScheduleRows(null)).toEqual([]);
    expect(normalizeScheduleRows(undefined)).toEqual([]);
    expect(normalizeScheduleRows({ schedules: 'wrapped again' })).toEqual([]);
    expect(normalizeScheduleRows('gibberish')).toEqual([]);
  });

  it('the headline defect: null start_time/END_TIME drop ONLY the poison row', () => {
    // Pre-cure this exact payload threw inside formatTime() during render and
    // blanked the entire schedules panel for the profile.
    const poison = { ...VALID, id: 8, name: 'Broken', start_time: null };
    const rows = normalizeScheduleRows([VALID, poison, { ...VALID, id: 9, end_time: null }]);
    expect(rows).toEqual([VALID]);
  });

  it('null days_of_week drops the row; a day outside the seven literals drops it too', () => {
    expect(normalizeScheduleRows([{ ...VALID, days_of_week: null }])).toEqual([]);
    // Partial repair would GUESS the window — never. One bad element = whole row untrusted.
    expect(normalizeScheduleRows([{ ...VALID, days_of_week: ['mon', 'funday'] }])).toEqual([]);
    expect(normalizeScheduleRows([{ ...VALID, days_of_week: 'mon,tue' }])).toEqual([]);
  });

  it('is_active must be a boolean — a string/number flag drops the row', () => {
    expect(normalizeScheduleRows([{ ...VALID, is_active: 'yes' }])).toEqual([]);
    expect(normalizeScheduleRows([{ ...VALID, is_active: 1 }])).toEqual([]);
  });

  it('identity + name must be parseable: non-integer or negative id, non-string name drop', () => {
    expect(normalizeScheduleRows([{ ...VALID, id: '7' }])).toEqual([]);
    expect(normalizeScheduleRows([{ ...VALID, id: 1.5 }])).toEqual([]);
    expect(normalizeScheduleRows([{ ...VALID, id: -1 }])).toEqual([]);
    expect(normalizeScheduleRows([{ ...VALID, name: null }])).toEqual([]);
  });

  it('times must be HH:MM or HH:MM:SS within clock bounds', () => {
    // The page renders formatTime via split(':') + parseInt; these are the
    // shapes formatTime can format without inventing NaN into the DOM.
    expect(normalizeScheduleRows([{ ...VALID, start_time: '9:30' }])).toHaveLength(1); // 1-digit hour ok
    expect(normalizeScheduleRows([{ ...VALID, start_time: '09:00:30' }])).toHaveLength(1); // SS arm ok
    expect(normalizeScheduleRows([{ ...VALID, end_time: '25:00' }])).toEqual([]); // hour out of range
    expect(normalizeScheduleRows([{ ...VALID, start_time: '09:75' }])).toEqual([]); // minute out of range
    expect(normalizeScheduleRows([{ ...VALID, start_time: '09:00:99' }])).toEqual([]); // second out of range
    expect(normalizeScheduleRows([{ ...VALID, end_time: 'noon' }])).toEqual([]); // not a time at all
    expect(normalizeScheduleRows([{ ...VALID, start_time: 57600 }])).toEqual([]); // epoch int is not HH:MM
  });

  it('the row OBJECT (not just its values) must be an object', () => {
    expect(normalizeScheduleRows(['a string row', null, 42, VALID])).toEqual([VALID]);
  });

  it('an all-poison list renders the empty state, not a crash (the panel sees [])', () => {
    expect(normalizeScheduleRows([{ id: 1 }])).toEqual([]);
  });
});
