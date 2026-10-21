// lib/currency/currencies.ts
// Invoice/receipt currencies. Any ISO-4217 code is a valid document currency
// as long as the MNB publishes a rate for it (the HUF rate is mandatory on a
// foreign-currency invoice — Áfa tv. 80. §); HUF/EUR/USD/GBP are the ones
// shown first.
export const PRIMARY_CURRENCIES = ["HUF", "EUR", "USD", "GBP"] as const;

/**
 * Fallback when the live MNB list cannot be fetched: the currencies the MNB
 * publishes a daily rate for. The live list (GetCurrentExchangeRates) is the
 * source of truth — see lib/exchange-rates/currencies.ts; a currency the MNB
 * dropped (e.g. HRK after the euro changeover) must not be offered.
 * TODO(sign-off): re-verify this static list against the MNB's published table.
 */
export const FALLBACK_MNB_CURRENCIES = [
  "AUD", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "EUR", "GBP", "HKD", "IDR", "ILS", "INR", "ISK", "JPY", "KRW",
  "MXN", "MYR", "NOK", "NZD", "PHP", "PLN", "RON", "RSD", "SEK", "SGD", "THB", "TRY", "UAH", "USD", "ZAR",
] as const;

export function isCurrencyCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}

const SYMBOLS: Record<string, string> = { EUR: "€", USD: "$", GBP: "£", HUF: "Ft" };

/** Symbol for the few currencies people expect one for; the ISO code otherwise. */
export function currencySymbol(currency: string): string {
  return SYMBOLS[currency] ?? currency;
}

/** Decimal places of the currency's minor unit (HUF/JPY/KRW… 0, most others 2). */
export function currencyFractionDigits(currency: string): number {
  if (currency === "HUF") return 0; // invoices in forint are whole forints
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** Order for a picker: the primary four first, then the rest alphabetically. */
export function orderCurrencies(codes: readonly string[]): string[] {
  const rest = [...new Set(codes)].filter((c) => !(PRIMARY_CURRENCIES as readonly string[]).includes(c)).sort();
  return [...PRIMARY_CURRENCIES, ...rest];
}
