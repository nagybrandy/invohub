// lib/invoices/exchange-rate-autofill.ts
// Server-side safety net: when an invoice is created or finalized in a
// non-HUF currency with no usable exchange rate, fetch the official MNB
// rate instead of leaving it empty (the composer already does this
// client-side — see components/invoices/composer/useInvoiceComposer.ts —
// but v1 API callers, or a client-side fetch that failed/raced, need the
// same fallback server-side). Never overrides a rate the caller already
// supplied, and never throws: if MNB is unreachable or has nothing for the
// date, this resolves to `undefined`, same as before this feature existed —
// the existing "missing exchange rate" banner (ExchangeRateFixBanner) is
// still the fallback of last resort.
import { requiresExchangeRate } from "@/lib/invoices/exchange-rate";
import { getExchangeRate } from "@/lib/exchange-rates/service";
import type { InvoiceCurrency } from "@/lib/invoices/types";

export type AutofillExchangeRateInput = {
  currency: InvoiceCurrency;
  /** The rate already on the invoice/payload, if any — a valid one is always kept as-is. */
  exchangeRate?: number;
  /** Áfa tv. 80. § date — teljesítés (fulfillment) when known, otherwise issueDate. */
  issueDate: string;
  fulfillmentDate?: string;
};

function hasValidRate(rate: number | undefined): rate is number {
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0;
}

/**
 * Resolves the exchange rate to persist: the caller's own valid rate,
 * unchanged; otherwise an MNB fetch for non-HUF currencies; otherwise
 * `undefined` (HUF never needs one, or MNB couldn't provide one).
 */
export async function autofillMissingExchangeRate(
  input: AutofillExchangeRateInput
): Promise<number | undefined> {
  if (hasValidRate(input.exchangeRate)) return input.exchangeRate;
  if (!requiresExchangeRate(input.currency)) return undefined;

  const date = input.fulfillmentDate?.trim() || input.issueDate;

  try {
    const result = await getExchangeRate(input.currency, date);
    return result?.rate;
  } catch {
    // MNB unreachable/erroring — fall back to the existing missing-rate
    // banner behaviour rather than failing the create/finalize request.
    return undefined;
  }
}
