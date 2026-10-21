// hooks/useSupportedCurrencies.ts
// The currencies an invoice/receipt can be issued in (GET /api/exchange-rates/currencies):
// HUF plus every currency the MNB currently publishes a rate for. Starts from
// the four primaries so the picker is usable before (or without) the answer.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import { PRIMARY_CURRENCIES } from "@/lib/currency/currencies";

let memo: string[] | null = null;

export function useSupportedCurrencies(): string[] {
  const [currencies, setCurrencies] = React.useState<string[]>(memo ?? [...PRIMARY_CURRENCIES]);

  React.useEffect(() => {
    if (memo) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<{ currencies: string[] }>("/api/exchange-rates/currencies");
        if (!Array.isArray(data?.currencies) || data.currencies.length === 0) return;
        memo = data.currencies;
        if (!cancelled) setCurrencies(data.currencies);
      } catch {
        /* keep the four primaries */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return currencies;
}

/** Test hook: forget the memoised answer. */
export function resetSupportedCurrenciesMemo(): void {
  memo = null;
}
