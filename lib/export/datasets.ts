// lib/export/datasets.ts
// The Adatexport menu: pick a dataset, narrow it down with filters, download a
// CSV. Pure — fetching and saving live in the screen.
import { buildCsv, csvNumber } from "@/lib/export/csv";
import { budapestDateKey } from "@/lib/dates/budapest";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import { invoiceListToCsv, type CsvLabels } from "@/lib/invoices/export-csv";
import type { Invoice } from "@/lib/invoices/types";
import type { Client } from "@/lib/clients/service";
import type { Product } from "@/lib/products/service";
import type { ReceiptRecord } from "@/lib/receipts/service";

export const EXPORT_DATASETS = ["invoices", "receipts", "clients", "products"] as const;
export type ExportDataset = (typeof EXPORT_DATASETS)[number];

export type ExportFilters = {
  /** Inclusive YYYY-MM-DD bounds on the issue date. Empty/undefined = open-ended. */
  from?: string;
  to?: string;
  /** Free text: matches partner/name, number and tax number (case-insensitive). */
  search?: string;
  /** Invoices only. */
  status?: string;
};

const norm = (s: string | undefined | null) => (s ?? "").toLowerCase();

/** YYYY-MM-DD part of an ISO date or datetime. */
const dayOf = (value: string) => value.slice(0, 10);

export function inDateRange(day: string, from?: string, to?: string): boolean {
  const d = dayOf(day);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function matchesSearch(haystack: Array<string | undefined | null>, search?: string): boolean {
  const q = norm(search).trim();
  return !q || haystack.some((h) => norm(h).includes(q));
}

export function filterInvoices(invoices: Invoice[], f: ExportFilters): Invoice[] {
  return invoices.filter(
    (i) =>
      inDateRange(i.issueDate, f.from, f.to) &&
      (!f.status || f.status === "all" || i.status === f.status) &&
      matchesSearch([i.clientName, i.invoiceNumber, i.clientTaxNumber], f.search),
  );
}

export function filterReceipts(receipts: ReceiptRecord[], f: ExportFilters): ReceiptRecord[] {
  return receipts.filter(
    (r) => inDateRange(r.issuedAt, f.from, f.to) && matchesSearch([r.receiptNumber, r.clientName], f.search),
  );
}

export function filterClients(clients: Client[], f: ExportFilters): Client[] {
  return clients.filter((c) => matchesSearch([c.name, c.taxNumber, c.email, c.city], f.search));
}

export function filterProducts(products: Product[], f: ExportFilters): Product[] {
  return products.filter((p) => matchesSearch([p.name, p.description], f.search));
}

export type ReceiptCsvLabels = {
  header: Record<"number" | "issuedAt" | "total" | "currency" | "paymentMethod" | "nav", string>;
  paymentMethod: (method: string) => string;
  navSubmitted: string;
  navPending: string;
};

export function receiptsToCsv(receipts: ReceiptRecord[], labels: ReceiptCsvLabels, language: string): string {
  const h = labels.header;
  return buildCsv(
    [h.number, h.issuedAt, h.total, h.currency, h.paymentMethod, h.nav],
    receipts.map((r) => [
      r.receiptNumber,
      dayOf(r.issuedAt),
      csvNumber(r.totalAmount, language),
      r.currency,
      labels.paymentMethod(r.paymentMethod),
      r.navSubmitted ? labels.navSubmitted : labels.navPending,
    ]),
  );
}

export type ClientCsvLabels = { header: Record<"name" | "taxNumber" | "email" | "zip" | "city" | "address" | "country", string> };

export function clientsToCsv(clients: Client[], labels: ClientCsvLabels): string {
  const h = labels.header;
  return buildCsv(
    [h.name, h.taxNumber, h.email, h.zip, h.city, h.address, h.country],
    clients.map((c) => [c.name, c.taxNumber ?? "", c.email ?? "", c.zipCode ?? "", c.city ?? "", c.address ?? "", c.country ?? ""]),
  );
}

export type ProductCsvLabels = { header: Record<"name" | "description" | "unitPrice" | "vatRate" | "unit" | "currency", string> };

export function productsToCsv(products: Product[], labels: ProductCsvLabels, language: string): string {
  const h = labels.header;
  return buildCsv(
    [h.name, h.description, h.unitPrice, h.vatRate, h.unit, h.currency],
    products.map((p) => [
      p.name,
      p.description ?? "",
      csvNumber(p.unitPrice, language),
      p.vatRate != null ? String(p.vatRate) : "",
      p.unit ?? "",
      p.currency ?? "",
    ]),
  );
}

export { invoiceListToCsv };
export type { CsvLabels };

/** Sum of the gross totals — shown next to the row count so the user can sanity-check a filter. */
export function invoiceGrossByCurrency(invoices: Invoice[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const inv of invoices) {
    out[inv.currency] = (out[inv.currency] ?? 0) + calculateInvoiceTotals(inv.lineItems).totalAmount;
  }
  return out;
}

export function exportFilename(dataset: ExportDataset, f: ExportFilters, now: Date): string {
  const base = { invoices: "szamlak", receipts: "nyugtak", clients: "partnerek", products: "termekek" }[dataset];
  const range = f.from || f.to ? `${f.from ?? "eleje"}_${f.to ?? "vege"}` : "osszes";
  const parts = [base, range];
  if (dataset === "invoices" && f.status && f.status !== "all") parts.push(f.status);
  return `${parts.join("-")}-${budapestDateKey(now)}.csv`;
}
