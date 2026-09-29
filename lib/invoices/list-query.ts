// lib/invoices/list-query.ts
// Pure invoice list filter normalization and match helpers (TDD-friendly).
import { isMissingExchangeRate } from "@/lib/invoices/exchange-rate";
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";
import { isIssuedDocument } from "@/lib/invoices/issued";

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
  /** YYYY-MM — keep the list on one month's issue dates. Unset = all time. */
  month?: string;
  /** Non-HUF invoices with no usable stored HUF rate (see lib/invoices/exchange-rate.ts). */
  needsExchangeRate?: boolean;
  /** Invoices whose latest NAV submission failed (error/aborted) — the "NAV-hiba" chip. */
  navFailed?: boolean;
};

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function normalizeInvoiceListFilters(input: {
  status?: string | null;
  search?: string | null;
  needsExchangeRate?: string | null;
  month?: string | null;
  navFailed?: string | null;
}): InvoiceListFilters {
  const rawStatus = input.status?.trim();
  const status =
    rawStatus && (INVOICE_LIST_STATUSES as string[]).includes(rawStatus)
      ? (rawStatus as InvoiceStatus)
      : undefined;

  const search = input.search?.trim() || undefined;
  const needsExchangeRate =
    input.needsExchangeRate === "1" || input.needsExchangeRate === "true" ? true : undefined;
  const rawMonth = input.month?.trim();
  const month = rawMonth && MONTH_PATTERN.test(rawMonth) ? rawMonth : undefined;
  const navFailed = input.navFailed === "1" || input.navFailed === "true" ? true : undefined;
  return { status, search, needsExchangeRate, month, navFailed };
}

export function invoiceMatchesListFilters(
  invoice: Pick<
    Invoice,
    "status" | "clientName" | "invoiceNumber" | "clientTaxNumber" | "currency" | "exchangeRate" | "issueDate" | "navStatus"
  > & { documentType?: Invoice["documentType"] },
  filters: InvoiceListFilters,
): boolean {
  if (filters.status && invoice.status !== filters.status) {
    return false;
  }

  if (filters.navFailed && invoice.navStatus !== "failed") {
    return false;
  }

  if (filters.month && !invoice.issueDate.startsWith(filters.month)) {
    return false;
  }

  // Only an issued document can be blocked by a missing rate: a draft gets
  // its rate when it is finalized (the finalize routes refuse without one),
  // and a díjbekérő is never submitted. Same rule as buildInvoiceListWhere.
  if (
    filters.needsExchangeRate &&
    !(isIssuedDocument(invoice) && isMissingExchangeRate(invoice))
  ) {
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
  month?: string;
  navFailed?: boolean;
}): string {
  const params = new URLSearchParams();
  params.set("limit", String(input.limit));
  if (input.month) {
    params.set("month", input.month);
  }
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
  if (input.navFailed) {
    params.set("navFailed", "1");
  }
  return params.toString();
}

/** First day of the month and of the next one — the half-open range the issue_date WHERE uses. */
export function monthIssueDateRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start: `${month}-01`, end: `${next}-01` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2026. szeptember" / "September 2026" — the stepper's label. */
export function formatMonthLabel(month: string, language: string): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  const locale = language.startsWith("hu") ? "hu-HU" : "en-US";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", timeZone: "UTC" }).format(date);
}
