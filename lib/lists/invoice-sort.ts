// lib/lists/invoice-sort.ts
// Client-side ordering of the loaded invoice pages (the "Kelt" header toggle,
// the filter sheet's "Rendezés" + direction). Pure so the list screen, the CSV
// export and the tests share one comparator.
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import type { Invoice } from "@/lib/invoices/types";

export type InvoiceSortKey = "issued" | "due" | "gross";
export type InvoiceListSort = { key: InvoiceSortKey; direction: "asc" | "desc" };

export const DEFAULT_INVOICE_SORT: InvoiceListSort = { key: "issued", direction: "desc" };

export function invoiceSortValue(invoice: Invoice, key: InvoiceSortKey): string | number {
  if (key === "issued") return invoice.issueDate;
  if (key === "due") return invoice.dueDate;
  return calculateInvoiceTotals(invoice.lineItems).totalAmount;
}

export function compareInvoices(a: Invoice, b: Invoice, sort: InvoiceListSort): number {
  const va = invoiceSortValue(a, sort.key);
  const vb = invoiceSortValue(b, sort.key);
  const diff = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
  return sort.direction === "asc" ? diff : -diff;
}

export function sortInvoices(invoices: Invoice[], sort: InvoiceListSort): Invoice[] {
  return [...invoices].sort((a, b) => compareInvoices(a, b, sort));
}

/** Header click: same column flips the direction, a new column starts ascending (dates: the screen's default is descending). */
export function nextSort(prev: InvoiceListSort, key: InvoiceSortKey): InvoiceListSort {
  return prev.key === key
    ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
    : { key, direction: "asc" };
}
