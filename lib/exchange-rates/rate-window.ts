// lib/exchange-rates/rate-window.ts
// Pure date-window / "latest rate on or before D" logic for MNB rate
// lookups. No I/O — lib/exchange-rates/service.ts wires this to the SOAP
// client and the DB cache.
import type { MnbRate } from "@/lib/exchange-rates/mnb";

/**
 * MNB doesn't publish on weekends or bank holidays. A run of consecutive
 * non-trading days in Hungary tops out around the turn-of-year break
 * (~5 days) — 10 gives comfortable margin without querying an unbounded
 * range.
 */
export const MNB_LOOKUP_WINDOW_DAYS = 10;

/** "YYYY-MM-DD" + N days (N may be negative), calendar-only — no timezone. */
export function addDaysIso(dateIso: string, days: number): string {
  const date = new Date(`${dateIso.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The [startDate, endDate] window to ask MNB's GetExchangeRates for, to find the rate for `targetDate`. */
export function buildLookupWindow(
  targetDate: string,
  windowDays: number = MNB_LOOKUP_WINDOW_DAYS
): { startDate: string; endDate: string } {
  return { startDate: addDaysIso(targetDate, -windowDays), endDate: targetDate };
}

/**
 * Áfa tv. 80. § HUF conversion rule: use the MNB rate published on the
 * relevant date — the invoice's teljesítés (fulfillment) date when known,
 * otherwise the issue date. MNB doesn't quote weekends/holidays, so "on the
 * relevant date" in practice means the latest published day on or before it
 * — see pickLatestRateOnOrBefore.
 */
export function resolveInvoiceRateDate(issueDate: string, fulfillmentDate?: string): string {
  return fulfillmentDate?.trim() || issueDate;
}

/**
 * The rate to use for `targetDate`: the given currency's rate on the latest
 * MNB-published day that is on or before `targetDate`. Returns null when
 * `rates` has nothing that qualifies (e.g. the whole lookup window predates
 * MNB's stored range, or the currency wasn't in the response).
 */
export function pickLatestRateOnOrBefore(
  rates: MnbRate[],
  currency: string,
  targetDate: string
): MnbRate | null {
  let best: MnbRate | null = null;
  for (const rate of rates) {
    if (rate.currency !== currency) continue;
    if (rate.date > targetDate) continue;
    if (!best || rate.date > best.date) best = rate;
  }
  return best;
}
