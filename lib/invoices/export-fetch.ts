// lib/invoices/export-fetch.ts
// Collects the whole filtered list for an export by walking the list API in
// max-size pages — the screen only ever holds the pages the user scrolled to.
import { apiFetch } from "@/lib/api/client";
import { INVOICE_LIST_MAX_LIMIT } from "@/lib/invoices/constants";
import { buildInvoiceListQueryString } from "@/lib/invoices/list-query";
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";

/** A hard stop so a runaway list can't hang the browser building one string. */
export const EXPORT_ROW_CAP = 5000;

export type ExportFilters = {
  status?: InvoiceStatus | "all";
  search?: string;
  month?: string;
  needsExchangeRate?: boolean;
  navFailed?: boolean;
};

type ListPage = { invoices?: Invoice[]; total?: number };

export async function fetchAllInvoicesForExport(
  filters: ExportFilters,
  fetchPage: (query: string) => Promise<ListPage> = (query) =>
    apiFetch<ListPage>(`/api/invoices?${query}`),
): Promise<{ invoices: Invoice[]; truncated: boolean }> {
  const seen = new Set<string>();
  const collected: Invoice[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (collected.length < total && collected.length < EXPORT_ROW_CAP) {
    const page = await fetchPage(
      buildInvoiceListQueryString({ ...filters, limit: INVOICE_LIST_MAX_LIMIT, offset }),
    );
    const rows = page.invoices ?? [];
    total = page.total ?? 0;
    if (rows.length === 0) break;
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      collected.push(row);
    }
    offset += rows.length;
  }

  return {
    invoices: collected.slice(0, EXPORT_ROW_CAP),
    truncated: total > EXPORT_ROW_CAP,
  };
}
