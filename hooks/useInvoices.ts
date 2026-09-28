// hooks/useInvoices.ts
// React hook for loading and mutating invoices via the API.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import { INVOICE_LIST_LIMIT } from "@/lib/invoices/constants";
import { buildInvoiceListQueryString } from "@/lib/invoices/list-query";
import type { InvoiceStats } from "@/lib/invoices/service";
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";

type InvoicesResponse = {
  invoices: Invoice[];
  total: number;
  limit: number;
  offset: number;
  stats: InvoiceStats;
  /** proformaId -> its live (non-cancelled) conversion's invoice id (AC12). */
  convertedProformaIds?: Record<string, string>;
};

type InvoiceResponse = { invoice: Invoice };

export type UseInvoicesOptions = {
  status?: InvoiceStatus | "all";
  search?: string;
  /** Non-HUF invoices with no usable stored HUF rate (see lib/invoices/exchange-rate.ts). */
  needsExchangeRate?: boolean;
  /** YYYY-MM — keep the list on one month's issue dates. Unset = all time. */
  month?: string;
  /** Rows per page; the screen uses the default, tests use a small one. */
  pageSize?: number;
};

const EMPTY_STATS: InvoiceStats = {
  count: 0,
  thisMonthCount: 0,
  monthlyTotal: 0,
};

const EMPTY_CONVERTED_PROFORMA_IDS: Record<string, string> = {};

export function useInvoices(options: UseInvoicesOptions = {}) {
  const status = options.status ?? "all";
  const search = options.search ?? "";
  const needsExchangeRate = options.needsExchangeRate ?? false;
  const month = options.month;
  const pageSize = options.pageSize ?? INVOICE_LIST_LIMIT;
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const [stats, setStats] = React.useState<InvoiceStats>(EMPTY_STATS);
  const [convertedProformaIds, setConvertedProformaIds] = React.useState<Record<string, string>>(
    EMPTY_CONVERTED_PROFORMA_IDS
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = buildInvoiceListQueryString({
        limit: pageSize,
        status,
        search,
        needsExchangeRate,
        month,
      });
      const data = await apiFetch<InvoicesResponse>(`/api/invoices?${query}`);
      // A partial or malformed response must not take every list screen down:
      // hasMore reads invoices.length on each render.
      setInvoices(data.invoices ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats);
      setConvertedProformaIds(data.convertedProformaIds ?? EMPTY_CONVERTED_PROFORMA_IDS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices.");
      setConvertedProformaIds(EMPTY_CONVERTED_PROFORMA_IDS);
    } finally {
      setLoading(false);
    }
  }, [status, search, needsExchangeRate, month, pageSize]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  // The list used to stop dead at INVOICE_LIST_LIMIT rows with no way on —
  // an EV issuing 5–40 invoices a month hit that in month two. Each call
  // appends the next page under the same filters.
  const hasMore = invoices.length < total;
  const loadMore = React.useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const query = buildInvoiceListQueryString({
        limit: pageSize,
        offset: invoices.length,
        status,
        search,
        needsExchangeRate,
        month,
      });
      const data = await apiFetch<InvoicesResponse>(`/api/invoices?${query}`);
      setInvoices((current) => {
        const seen = new Set(current.map((inv) => inv.id));
        return [...current, ...(data.invoices ?? []).filter((inv) => !seen.has(inv.id))];
      });
      setTotal((current) => data.total ?? current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more invoices.");
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, invoices.length, pageSize, status, search, needsExchangeRate, month]);

  const addOrUpdate = React.useCallback(
    async (invoice: Invoice) => {
      const existing = invoices.find((inv) => inv.id === invoice.id);
      const data = existing
        ? await apiFetch<InvoiceResponse>(`/api/invoices/${invoice.id}`, {
            method: "PATCH",
            body: JSON.stringify(invoice),
          })
        : await apiFetch<InvoiceResponse>("/api/invoices", {
            method: "POST",
            body: JSON.stringify(invoice),
          });
      await refresh();
      return data.invoice;
    },
    [invoices, refresh]
  );

  const remove = React.useCallback(
    async (id: string) => {
      await apiFetch(`/api/invoices/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh]
  );

  return {
    invoices,
    total,
    loading,
    error,
    stats,
    convertedProformaIds,
    refresh,
    addOrUpdate,
    remove,
    hasMore,
    loadMore,
    loadingMore,
  };
}
