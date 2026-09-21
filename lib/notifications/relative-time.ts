// lib/notifications/relative-time.ts
// Pure descriptor for "how long ago" a notification timestamp is. Returns a
// descriptor, never a rendered string, so the caller can localise it via
// i18n keys instead of baking English words into this module.
import { formatDateOnly } from "@/lib/dates/format";

export type RelativeWhen =
  | { kind: "justNow" }
  | { kind: "minutes"; count: number }
  | { kind: "hours"; count: number }
  | { kind: "yesterday" }
  | { kind: "absolute"; date: string };

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Describes how long ago `iso` was, relative to `now`.
 *
 * - Unparseable input never throws: it falls back to `{ kind: "absolute",
 *   date: iso }` with the raw string.
 * - A timestamp in the future up to 24h ahead reads as `justNow` (clock
 *   skew, not "time travel" text); further in the future falls back to
 *   `absolute` rather than ever showing a negative count.
 */
export function describeRelativeWhen(iso: string, now: Date): RelativeWhen {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { kind: "absolute", date: iso };
  }

  const diffMs = now.getTime() - date.getTime();

  // Future timestamps: treat clock skew up to 24h as "just now"; anything
  // further ahead falls back to an absolute date rather than a negative
  // minutes/hours count.
  if (diffMs < 0) {
    return diffMs >= -DAY_MS ? { kind: "justNow" } : { kind: "absolute", date: formatDateOnly(iso) };
  }

  if (diffMs < MINUTE_MS) return { kind: "justNow" };
  if (diffMs < HOUR_MS) return { kind: "minutes", count: Math.floor(diffMs / MINUTE_MS) };
  if (diffMs < DAY_MS) return { kind: "hours", count: Math.floor(diffMs / HOUR_MS) };
  if (diffMs < 2 * DAY_MS) return { kind: "yesterday" };
  return { kind: "absolute", date: formatDateOnly(iso) };
}
