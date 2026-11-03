/**
 * parentalTimeStepper — pure minute-stepping for the parental schedule form.
 *
 * The schedule window used two native `<input type="time">` fields (deferred
 * review m3): on a no-pointer, no-IME TV webview a segment-editing text
 * control is operable theater — the D-pad can focus it, but every interaction
 * past focus wants a mouse. ParentalControlsPage now renders symbol buttons
 * around a readout, and this module owns the arithmetic so the page stays
 * presentational:
 *
 *   parse an existing wire time → step by whole minutes → wrap the 24-hour
 *   clock → re-serialize IN THE SOURCE SHAPE.
 *
 * Shape-preservation is the wire law: a value the server sent as 'HH:MM'
 * never grows a seconds segment, and 'HH:MM:SS' keeps its seconds — the PUT/
 * POST body stays the exact bytes that came in until the viewer actually
 * steps (S325b wire-shape discipline extended to writes).
 *
 * The function is TOTAL: invalid input (unparseable, hour > 23) degrades to
 * stepping from midnight instead of throwing — Fail Fast belongs to the
 * caller's validation; bricking the schedule editor over one corrupt stored
 * row would trap the viewer behind a dead form. The degradation is pin-tested,
 * not hopeful.
 *
 * @category Pure helpers
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

/** One remote-key press: fifteen minutes (matches the day-picker's granularity). */
export const STEP_QUARTER_MINUTES = 15;
/** The long-press/coarse rung: sixty minutes. */
export const STEP_HOUR_MINUTES = 60;

/** 'HH:MM' or 'HH:MM:SS' with numeric segments; nothing else parses. */
const TIME_RE = /^(\d{1,2}):(\d{2})(:\d{2})?$/;

const MINUTES_PER_DAY = 1440;

/**
 * Step a wire time by `deltaMinutes`, wrapping around the 24-hour clock.
 * Output keeps the input's seconds segment when it had one. A value outside
 * the grammar ('', 'garbage', '24:60', '99:99:59') steps from 00:00 and still
 * preserves a matched seconds suffix when the shape allowed the split.
 */
export function stepTime(raw: string, deltaMinutes: number): string {
  const match = TIME_RE.exec(raw);
  const hours = match ? Number(match[1]) : 0;
  const minutes = match ? Number(match[2]) : 0;
  const secondsSuffix = match && match[3] ? match[3] : '';
  const hourInDay = match !== null && hours <= 23 && minutes <= 59;

  const total = (hourInDay ? hours * 60 + minutes : 0) + deltaMinutes;
  const wrapped = ((total % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

  const hh = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const mm = String(wrapped % 60).padStart(2, '0');
  return `${hh}:${mm}${secondsSuffix}`;
}
