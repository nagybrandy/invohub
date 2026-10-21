// lib/exchange-rates/currencies.ts
// Which currencies an invoice may use: those the MNB currently publishes a
// rate for. Asked of the MNB (GetCurrentExchangeRates) and kept in memory for
// a few hours; a failure falls back to the static list, never to an empty one.
import { FALLBACK_MNB_CURRENCIES, orderCurrencies } from "@/lib/currency/currencies";
import { fetchMnbCurrentExchangeRates } from "@/lib/exchange-rates/mnb";

const TTL_MS = 6 * 60 * 60 * 1000;
let cache: { at: number; codes: string[] } | null = null;

export function resetSupportedCurrenciesCache(): void {
  cache = null;
}

/** HUF first-class plus every currency with a current MNB rate, primaries first. */
export async function getSupportedCurrencies(
  now: number = Date.now(),
  fetchRates: typeof fetchMnbCurrentExchangeRates = fetchMnbCurrentExchangeRates,
): Promise<{ currencies: string[]; source: "mnb" | "fallback" }> {
  if (cache && now - cache.at < TTL_MS) return { currencies: cache.codes, source: "mnb" };
  try {
    const rates = await fetchRates();
    const live = [...new Set(rates.map((r) => r.currency).filter((c) => /^[A-Z]{3}$/.test(c) && c !== "HUF"))];
    if (live.length >= 5) {
      const codes = orderCurrencies(["HUF", ...live]);
      cache = { at: now, codes };
      return { currencies: codes, source: "mnb" };
    }
  } catch {
    /* fall through to the static list */
  }
  return { currencies: orderCurrencies(["HUF", ...FALLBACK_MNB_CURRENCIES]), source: "fallback" };
}
