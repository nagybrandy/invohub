// lib/lists/footer-stats.ts
// Totals for the bottom of a list: how many rows, and their sums per
// currency. Never adds across currencies — a HUF and an EUR total stay two
// lines, the same rule the dashboard follows.
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import type { Invoice } from "@/lib/invoices/types";

export type CurrencyTotals = { currency: string; net: number; vat: number; gross: number };
export type ListFooterSummary = { count: number; byCurrency: CurrencyTotals[] };

function add(map: Map<string, CurrencyTotals>, currency: string, net: number, vat: number, gross: number) {
  const row = map.get(currency) ?? { currency, net: 0, vat: 0, gross: 0 };
  row.net += net;
  row.vat += vat;
  row.gross += gross;
  map.set(currency, row);
}

function sorted(map: Map<string, CurrencyTotals>): CurrencyTotals[] {
  // HUF first, then alphabetically — the primary currency reads first.
  return [...map.values()].sort((a, b) =>
    a.currency === "HUF" ? -1 : b.currency === "HUF" ? 1 : a.currency.localeCompare(b.currency),
  );
}

export function summarizeInvoices(invoices: Pick<Invoice, "currency" | "lineItems">[]): ListFooterSummary {
  const map = new Map<string, CurrencyTotals>();
  for (const invoice of invoices) {
    const totals = calculateInvoiceTotals(invoice.lineItems);
    add(map, invoice.currency, totals.subtotal, totals.vatTotal, totals.totalAmount);
  }
  return { count: invoices.length, byCurrency: sorted(map) };
}

export function summarizeReceipts(
  receipts: { currency: string; totalAmount: number }[],
): ListFooterSummary {
  const map = new Map<string, CurrencyTotals>();
  for (const receipt of receipts) add(map, receipt.currency, 0, 0, receipt.totalAmount);
  return { count: receipts.length, byCurrency: sorted(map) };
}
