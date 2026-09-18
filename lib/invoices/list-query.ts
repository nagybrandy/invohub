// lib/invoices/list-query.ts
// Pure invoice list filter normalization and match helpers (TDD-friendly).
import { isMissingExchangeRate } from "@/lib/invoices/exchange-rate";
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";

export const INVOICE_LIST_STATUSES: InvoiceStatus[] = [
  "draft",
  "proforma",
  "sent",
  "paid",
  "partially_paid",
  "unpaid",
  "overdue",
  "cancelled",
];

export type InvoiceListFilters = {
  status?: InvoiceStatus;
  search?: string;
  /** Non-HUF invoices with no usable stored HUF rate (see lib/invoices/exchange-rate.ts). */
  needsExchangeRate?: boolean;
};

export function normalizeInvoiceListFilters(input: {
  status?: string | null;
  search?: string | null;
  needsExchangeRate?: string | null;
}): InvoiceListFilters {
  const rawStatus = input.status?.trim();
  const status =
    rawStatus && (INVOICE_LIST_STATUSES as string[]).includes(rawStatus)
      ? (rawStatus as InvoiceStatus)
      : undefined;

  const search = input.search?.trim() || undefined;
  const needsExchangeRate =
    input.needsExchangeRate === "1" || input.needsExchangeRate === "true" ? true : undefined;
  return { status, search, needsExchangeRate };
}

export function invoiceMatchesListFilters(
  invoice: Pick<
    Invoice,
    "status" | "clientName" | "invoiceNumber" | "clientTaxNumber" | "currency" | "exchangeRate"
  >,
  filters: InvoiceListFilters,
): boolean {
  if (filters.status && invoice.status !== filters.status) {
    return false;
  }

  if (filters.needsExchangeRate && !isMissingExchangeRate(invoice)) {
    return false;
  }

  if (!filters.search) {
    return true;
  }

  const needle = filters.search.toLowerCase();
  const haystacks = [
    invoice.clientName,
    invoice.invoiceNumber,
    invoice.clientTaxNumber ?? "",
  ];
  return haystacks.some((value) => value.toLowerCase().includes(needle));
}

export function buildInvoiceListQueryString(input: {
  limit: number;
  offset?: number;
  status?: InvoiceStatus | "all";
  search?: string;
  needsExchangeRate?: boolean;
}): string {
  const params = new URLSearchParams();
  params.set("limit", String(input.limit));
  if (input.offset && input.offset > 0) {
    params.set("offset", String(input.offset));
  }
  if (input.status && input.status !== "all") {
    params.set("status", input.status);
  }
  const search = input.search?.trim();
  if (search) {
    params.set("search", search);
  }
  if (input.needsExchangeRate) {
    params.set("needsExchangeRate", "1");
  }
  return params.toString();
}
