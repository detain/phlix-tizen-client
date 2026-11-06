/**
 * Parental-controls schedule rows: the wire-boundary parse (RT-054).
 *
 * The server's `AccessSchedule::toArray()` DTO carries SQL NULL verbatim into
 * unset columns, so a list response can legitimately contain
 * `{ start_time: null }` (or null days / a string flag). The page used to
 * cast `data.schedules` straight into `AccessSchedule[]`; the render path then
 * threw `TypeError: Cannot read properties of null` inside `formatTime` /
 * `formatDays` — and because the throw happened in the v-for, the WHOLE
 * schedule list (healthy rows included) failed to render: a blank parental
 * panel with no error surface (review tizen__exploiter #5).
 *
 * The contract for this boundary is the estate's reject-poison-per-row idiom
 * (mirrors `saneMarker` in SkipIntroOverlay.vue and the S234 boundary
 * parsers): a row renders ONLY when every field the renderer will
 * dereference carries its declared type; a rejected row is dropped while its
 * siblings survive. Dropping is the SAFE direction for parental controls by
 * construction — an AccessSchedule declares the window during which a profile
 * MAY stream, so a corrupt row is never partially trusted (a mixed
 * `days_of_week` list would silently change WHICH days the window covers,
 * and repairing "most" of a time pair could widen access past its intended
 * bounds). The parent recreates the dropped row from the UI.
 *
 * `profileId` maps BOTH spellings: the contract interface keeps the
 * historical `profileId` name while the server's wire emission is
 * `profile_id` (S234 note in @phlix/contracts). Neither present → the empty
 * string — the page never dereferences it (the route param is the actor),
 * but the declared field must stay a string, and fabricating an id is
 * forbidden; an absent slot is honestly empty, and `''` reads as "no profile
 * bound" at every consumer that could ever care.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import type { AccessSchedule, DayOfWeek } from '@phlix/contracts';

/** The seven literals the contract's DayOfWeek admits. */
const DAY_NAMES: readonly DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * "HH:MM" or "HH:MM:SS" with clock bounds checked. The page's formatTime
 * parses via split(':') + parseInt, so anything this gate admits renders a
 * real 12-hour label; anything it refuses would have printed NaN.
 */
const CLOCK_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

function parseClock(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const match = CLOCK_RE.exec(raw);
  if (match === null) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] === undefined ? 0 : Number(match[3]);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return raw;
}

function parseDays(raw: unknown): DayOfWeek[] | null {
  if (!Array.isArray(raw)) return null;
  const days: DayOfWeek[] = [];
  for (const entry of raw) {
    // ONE element outside the closed set makes the whole row untrusted:
    // silently dropping the bad day would GUESS at the window's coverage.
    if (typeof entry !== 'string' || !DAY_NAMES.includes(entry as DayOfWeek)) return null;
    days.push(entry as DayOfWeek);
  }
  return days;
}

function parseProfileId(record: Record<string, unknown>): string {
  if (typeof record.profileId === 'string') return record.profileId;
  if (typeof record.profile_id === 'string') return record.profile_id;
  return '';
}

/**
 * Parse one wire row; `null` = drop it (the caller maps, never renders, this
 * function's output). The input is `unknown` on purpose — Law 2: everything
 * from the HTTP boundary is re-parsed here, nothing above is trusted.
 */
export function normalizeScheduleRow(raw: unknown): AccessSchedule | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;

  const id = record.id;
  if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) return null;

  const name = record.name;
  if (typeof name !== 'string') return null;

  const startTime = parseClock(record.start_time);
  const endTime = parseClock(record.end_time);
  if (startTime === null || endTime === null) return null;

  const days = parseDays(record.days_of_week);
  if (days === null) return null;

  const isActive = record.is_active;
  if (typeof isActive !== 'boolean') return null;

  return {
    id,
    profileId: parseProfileId(record),
    name,
    start_time: startTime,
    end_time: endTime,
    days_of_week: days,
    is_active: isActive,
  };
}

/**
 * Parse a whole list payload. A non-array body (the top-level defect the old
 * `?? []` papered over at an unexpected depth) yields `[]` — the empty-state
 * copy, never a crash.
 */
export function normalizeScheduleRows(raw: unknown): AccessSchedule[] {
  if (!Array.isArray(raw)) return [];
  const rows: AccessSchedule[] = [];
  for (const entry of raw) {
    const row = normalizeScheduleRow(entry);
    if (row !== null) rows.push(row);
  }
  return rows;
}
