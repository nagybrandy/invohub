// lib/recurring/schedule.ts
// Pure schedule maths for recurring invoice templates (no DB, no clock).
//
// Decisions (documented because they are easy to get subtly wrong):
// - Occurrence N is computed from the ORIGINAL start date, never from the
//   previous occurrence: monthly from Jan 31 gives Jan 31, Feb 28/29, Mar 31
//   (anchor on the original day-of-month, clamp to the month end).
// - Yearly from Feb 29 gives Feb 28 in non-leap years and Feb 29 again in
//   leap years.
// - `endDate` is INCLUSIVE: an occurrence falling exactly on endDate is
//   still generated.
// - `maxOccurrences` counts the first occurrence (3 = start + 2 more).
// - If both end conditions are set, whichever ends the series first wins.
// - "Today" is always a Europe/Budapest calendar day key (see
//   lib/dates/budapest.ts), passed in by the caller — never the UTC day.
// - Catch-up policy: resolveDue reports only the OLDEST outstanding period;
//   the caller generates at most one draft per template per run.
//
// Dates are `YYYY-MM-DD` strings throughout so no timezone can shift them.

export const RECURRENCE_FREQUENCIES = ["monthly", "quarterly", "yearly"] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export type RecurrenceSchedule = {
  frequency: RecurrenceFrequency;
  /** First occurrence, `YYYY-MM-DD`. Its day-of-month is the anchor. */
  startDate: string;
  /** Last allowed occurrence date (inclusive), `YYYY-MM-DD`. */
  endDate?: string | null;
  /** Total number of occurrences, counting the first. */
  maxOccurrences?: number | null;
};

const MONTHS_PER_STEP: Record<RecurrenceFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** The date of occurrence `index` ignoring end conditions. */
function rawOccurrence(schedule: RecurrenceSchedule, index: number): string {
  const m = DATE_RE.exec(schedule.startDate)!;
  const year = Number(m[1]);
  const month0 = Number(m[2]) - 1;
  const day = Number(m[3]);
  const total = month0 + index * MONTHS_PER_STEP[schedule.frequency];
  const y = year + Math.floor(total / 12);
  const mo = ((total % 12) + 12) % 12 + 1;
  const d = Math.min(day, daysInMonth(y, mo));
  return `${pad(y, 4)}-${pad(mo)}-${pad(d)}`;
}

/**
 * Date of the `index`-th (0-based) occurrence, or null when the series has
 * ended before it (end date passed / occurrence count reached).
 */
export function occurrenceDate(schedule: RecurrenceSchedule, index: number): string | null {
  if (!Number.isInteger(index) || index < 0) return null;
  if (schedule.maxOccurrences != null && index >= schedule.maxOccurrences) return null;
  const date = rawOccurrence(schedule, index);
  if (schedule.endDate && date > schedule.endDate) return null;
  return date;
}

/** Smallest index whose date is on/after `date` (ignores end conditions). */
export function firstIndexOnOrAfter(schedule: RecurrenceSchedule, date: string): number {
  let index = 0;
  // Series are at most monthly, so this loop is short for any realistic gap.
  while (rawOccurrence(schedule, index) < date) index += 1;
  return index;
}

export type DueResolution =
  | { state: "waiting"; nextRunDate: string }
  | { state: "due"; index: number; periodKey: string; periodDate: string }
  | { state: "completed" };

/**
 * What to do for a template whose next un-generated occurrence is `nextIndex`,
 * on Budapest calendar day `today`. Only the oldest outstanding period is
 * ever reported as due (one draft per template per run).
 */
export function resolveDue(
  schedule: RecurrenceSchedule,
  nextIndex: number,
  today: string
): DueResolution {
  const date = occurrenceDate(schedule, nextIndex);
  if (date === null) return { state: "completed" };
  if (date > today) return { state: "waiting", nextRunDate: date };
  return { state: "due", index: nextIndex, periodKey: date, periodDate: date };
}

export type ScheduleValidation = { ok: true } | { ok: false; error: string };

export function validateSchedule(schedule: RecurrenceSchedule): ScheduleValidation {
  if (!RECURRENCE_FREQUENCIES.includes(schedule.frequency)) {
    return { ok: false, error: "frequency must be monthly, quarterly or yearly" };
  }
  if (!isValidDateKey(schedule.startDate)) {
    return { ok: false, error: "startDate must be a valid YYYY-MM-DD date" };
  }
  if (schedule.endDate != null) {
    if (!isValidDateKey(schedule.endDate)) {
      return { ok: false, error: "endDate must be a valid YYYY-MM-DD date" };
    }
    if (schedule.endDate < schedule.startDate) {
      return { ok: false, error: "endDate must not be before startDate" };
    }
  }
  if (schedule.maxOccurrences != null) {
    if (!Number.isInteger(schedule.maxOccurrences) || schedule.maxOccurrences < 1) {
      return { ok: false, error: "maxOccurrences must be a positive integer" };
    }
  }
  return { ok: true };
}
