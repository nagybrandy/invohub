// lib/exchange-rates/service.ts
// Cache-first MNB exchange rate lookup — the single entry point everything
// else (API routes, the composer's auto-fetch, the server-side create/
// finalize safety net) should use instead of calling lib/exchange-rates/mnb.ts
// directly.
//
// Strategy: an exact (currency, date) cache hit is unambiguous (that date
// had its own published MNB rate, so "latest on or before" trivially
// resolves to itself) and skips the network entirely. Otherwise — the date
// is a weekend/holiday with no rate of its own, or simply hasn't been
// fetched before — fetch the whole MNB_LOOKUP_WINDOW_DAYS window fresh, cache
// every day it returns (growing future fast-path coverage), and pick the
// latest day on or before the target date. Never negative-caches: a date
// with no answer (e.g. today, before MNB's ~noon publish time) simply isn't
// written to the DB, so the next call tries again instead of being stuck.
import { getCachedRate, saveRates } from "@/lib/exchange-rates/cache";
import { fetchMnbExchangeRates, normalizeRatePerUnit } from "@/lib/exchange-rates/mnb";
import { buildLookupWindow, pickLatestRateOnOrBefore } from "@/lib/exchange-rates/rate-window";

export type ExchangeRateResult = {
  currency: string;
  rate: number;
  /** The MNB-published day the rate is actually from — may be earlier than the requested date. */
  rateDate: string;
  source: "MNB";
};

/**
 * Resolves the official MNB HUF rate for `currency` on `date` ("latest
 * published on or before date" — see lib/exchange-rates/rate-window.ts).
 * Returns null when MNB genuinely has nothing for the currency within the
 * lookup window (e.g. an unsupported code, or a date far outside MNB's
 * stored range) — never for a transient failure, which throws instead
 * (MnbFetchError from lib/exchange-rates/mnb.ts) so callers can tell "no
 * rate exists" apart from "couldn't check right now".
 *
 * `currency` must not be "HUF" — callers should short-circuit HUF (always
 * rate 1) via requiresExchangeRate before reaching here.
 */
export async function getExchangeRate(
  currency: string,
  date: string,
  fetchImpl: typeof fetch = fetch
): Promise<ExchangeRateResult | null> {
  if (currency === "HUF") {
    throw new Error("getExchangeRate: HUF never needs an MNB rate (it's always 1).");
  }

  const cached = await getCachedRate(currency, date);
  if (cached) {
    return { currency: cached.currency, rate: cached.rate, rateDate: cached.rateDate, source: "MNB" };
  }

  const { startDate, endDate } = buildLookupWindow(date);
  const rates = await fetchMnbExchangeRates({ startDate, endDate, currencies: [currency] }, fetchImpl);

  if (rates.length > 0) {
    await saveRates(
      rates.map((rate) => ({
        currency: rate.currency,
        rateDate: rate.date,
        rate: normalizeRatePerUnit(rate),
      }))
    );
  }

  const picked = pickLatestRateOnOrBefore(rates, currency, date);
  if (!picked) return null;

  return {
    currency,
    rate: normalizeRatePerUnit(picked),
    rateDate: picked.date,
    source: "MNB",
  };
}
