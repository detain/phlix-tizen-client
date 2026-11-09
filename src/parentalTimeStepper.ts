/**
 * parentalTimeStepper — pure stepper arithmetic for the parental-control forms:
 * minute-stepping for the schedule window (w13: RT-103 added the bounded
 * number-stepping for the stream-limit fields; same module by design — both
 * are the remote-press math the page must not own inline).
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

/**
 * w13: RT-103 (review tizen__gameux #4) — the stream-limit form's two
 * `type="number"` fields kept the pointer era's wheel/spinner arrows on a
 * no-pointer device. The page now renders D-pad symbol buttons around the
 * SAME inputs (typing stays precise; the buttons are the remote path), and
 * this module owns their arithmetic the same way {@link stepTime} owns the
 * schedule window's.
 *
 * Total by contract, mirroring stepTime's stance: an absent or poisoned value
 * (null — bandwidth's "unlimited" — or a non-finite read after the `.number`
 * modifier chewed up an empty field) restarts at `min` rather than throwing
 * or yielding NaN back into the form. Stepping DOWN from unlimited landing
 * on `min` is deliberate: it means "cap this", the direction the remote press
 * asked for; typed entry remains the precise path.
 */
export function stepNumber(
  raw: number | null | undefined,
  delta: number,
  min: number,
  max: number,
): number {
  const base = typeof raw === 'number' && Number.isFinite(raw) ? raw : min;
  return Math.min(max, Math.max(min, base + delta));
}

/** One coarse press on a bandwidth field: 1000 kbps (the display unit's rung). */
export const STEP_BANDWIDTH_KBPS = 1000;

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
