// lib/invoices/filter-invoices.ts
// Invoice list status filter helpers.
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";

export type InvoiceStatusFilter = InvoiceStatus | "all";

export const INVOICE_STATUS_FILTERS: InvoiceStatusFilter[] = [
  "all",
  "draft",
  "proforma",
  "sent",
  "paid",
  "overdue",
  "cancelled",
];

export function filterInvoicesByStatus(
  invoices: Invoice[],
  filter: InvoiceStatusFilter
): Invoice[] {
  if (filter === "all") return invoices;
  return invoices.filter((invoice) => invoice.status === filter);
}

/** i18n key for a status filter chip label. */
export function invoiceStatusFilterI18nKey(
  filter: InvoiceStatusFilter
): string {
  if (filter === "all") return "invoices.filters.all";
  return `invoices.status.${filter}`;
}
