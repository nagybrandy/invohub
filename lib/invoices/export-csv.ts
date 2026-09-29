// lib/invoices/export-csv.ts
// The filtered invoice list as a CSV the könyvelő's Excel opens as-is:
// UTF-8 with a BOM (so accents survive), ';' separated (the Hungarian Excel
// default), CRLF, decimals with a comma for Hungarian. This is a bookkeeping
// export — the 23/2014 NGM XML (tax-audit-export) remains the audit format.
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import type { Invoice, PaymentMethod } from "@/lib/invoices/types";
import { budapestDateKey } from "@/lib/dates/budapest";

export const CSV_COLUMNS = [
  "number",
  "type",
  "client",
  "clientTaxNumber",
  "issueDate",
  "fulfillmentDate",
  "dueDate",
  "net",
  "vat",
  "gross",
  "currency",
  "status",
  "paidAt",
  "paymentMethod",
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

export type CsvLabels = {
  header: Record<CsvColumn, string>;
  status: (invoice: Invoice) => string;
  documentType: (invoice: Invoice) => string;
  paymentMethod: (method: PaymentMethod) => string;
  /** What to print where a draft has no number yet. */
  draftNumber: string;
};

const SEPARATOR = ";";
const EOL = "\r\n";
const BOM = "﻿";

export function csvField(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function csvNumber(value: number, language: string): string {
  const fixed = (Math.round(value * 100) / 100).toFixed(2);
  return language.startsWith("hu") ? fixed.replace(".", ",") : fixed;
}

export function invoiceListToCsv(
  invoices: Invoice[],
  labels: CsvLabels,
  language: string,
): string {
  const rows: string[][] = [CSV_COLUMNS.map((column) => labels.header[column])];
  for (const invoice of invoices) {
    const totals = calculateInvoiceTotals(invoice.lineItems);
    rows.push([
      invoice.invoiceNumber || labels.draftNumber,
      labels.documentType(invoice),
      invoice.clientName,
      invoice.clientTaxNumber ?? "",
      invoice.issueDate,
      invoice.fulfillmentDate ?? invoice.issueDate,
      invoice.dueDate,
      csvNumber(totals.subtotal, language),
      csvNumber(totals.vatTotal, language),
      csvNumber(totals.totalAmount, language),
      invoice.currency,
      labels.status(invoice),
      invoice.paidAt ? invoice.paidAt.slice(0, 10) : "",
      invoice.paymentMethod ? labels.paymentMethod(invoice.paymentMethod) : "",
    ]);
  }
  return BOM + rows.map((row) => row.map(csvField).join(SEPARATOR)).join(EOL) + EOL;
}

export function csvExportFilename(
  filters: { month?: string; status?: string },
  now: Date,
): string {
  const parts = ["szamlak", filters.month ?? "osszes"];
  if (filters.status && filters.status !== "all") parts.push(filters.status);
  return `${parts.join("-")}-${budapestDateKey(now)}.csv`;
}
