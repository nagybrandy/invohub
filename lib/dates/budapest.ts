// lib/dates/budapest.ts
// Pure Europe/Budapest calendar-day helpers, built on Intl.DateTimeFormat
// (no new dependency — @date-fns/tz is not installed). Used by the NAV
// receipt-report cron so a nyugta issued shortly after midnight local time
// is aggregated and reported under the correct Hungarian calendar day
// instead of the server process's UTC day.
const TIME_ZONE = "Europe/Budapest";

// en-CA formats as YYYY-MM-DD, which is exactly the date-key shape we want.
const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const wallClockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** The Europe/Budapest calendar date (`YYYY-MM-DD`) that `instant` falls on. */
export function budapestDateKey(instant: Date): string {
  return dateKeyFormatter.format(instant);
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

/** `dateKey` shifted by `delta` calendar days (may be negative), still `YYYY-MM-DD`. */
export function addBudapestDays(dateKey: string, delta: number): string {
  const { year, month, day } = parseDateKey(dateKey);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + delta);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** The zone's UTC offset (ms) in effect at `instant`, i.e. wallClock(instant) - instant. */
function budapestOffsetMs(instant: Date): number {
  const parts = wallClockFormatter.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return asUtc - instant.getTime();
}

/** The UTC instant of 00:00:00.000 local time in Europe/Budapest on `dateKey`. */
function budapestMidnightToUtc(dateKey: string): Date {
  const { year, month, day } = parseDateKey(dateKey);
  const naiveUtcGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  // Two-step fixed-point iteration converges even across a DST transition:
  // the offset can only change once between the naive guess and the truth.
  let instantMs = naiveUtcGuess;
  for (let i = 0; i < 2; i++) {
    const offset = budapestOffsetMs(new Date(instantMs));
    instantMs = naiveUtcGuess - offset;
  }
  return new Date(instantMs);
}

/**
 * The UTC instants bounding the Europe/Budapest calendar day `dateKey`,
 * DST-correct (23 h on the spring-forward day, 25 h on the fall-back day).
 */
export function budapestDayRange(dateKey: string): { start: Date; end: Date } {
  const start = budapestMidnightToUtc(dateKey);
  const nextDayStart = budapestMidnightToUtc(addBudapestDays(dateKey, 1));
  const end = new Date(nextDayStart.getTime() - 1);
  return { start, end };
}
