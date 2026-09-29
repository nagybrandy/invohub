// lib/nav/reported-amounts.ts
// What a NAV submission actually reported, for the audit trail
// lib/nav/reported-rate.ts reads: the invoice currency, the <exchangeRate>
// the XML carried, and the summed per-line HUF VAT. Pure — computed from the
// same inputs, in the same order, as lib/nav/invoice-xml.ts, so the recorded
// numbers can never disagree with the XML that was sent.
import { lineItemVatAmount } from "@/lib/invoices/calculations";
import { formatExchangeRate, resolveExchangeRate, toHufAmount } from "@/lib/invoices/exchange-rate";
import type { Invoice } from "@/lib/invoices/types";

export type NavReportedAmounts = {
  reportedCurrency: string;
  /** formatExchangeRate form, e.g. "392.500000". */
  reportedExchangeRate: string;
  /** Two decimals, HUF. */
  reportedVatHuf: string;
};

export function computeNavReportedAmounts(
  invoice: Pick<Invoice, "currency" | "exchangeRate" | "lineItems">
): NavReportedAmounts {
  // buildNavInvoiceXml throws on an unusable rate before anything is sent,
  // so by the time a submission is recorded the rate always resolves; the
  // fallback only keeps this function total.
  const resolution = resolveExchangeRate(invoice as Invoice);
  const rate = resolution.ok ? resolution.rate : 1;
  // Per line, then summed — the order <lineVatAmountHUF> and the summary
  // totals use (exempt/reverse-charge lines already carry vatRate 0).
  const vatHuf = invoice.lineItems.reduce(
    (sum, line) => sum + toHufAmount(lineItemVatAmount(line), rate),
    0
  );
  return {
    reportedCurrency: invoice.currency,
    reportedExchangeRate: formatExchangeRate(rate),
    reportedVatHuf: vatHuf.toFixed(2),
  };
}
