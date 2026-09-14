// hooks/useDashboardSummary.ts
// Loads the SQL-aggregated dashboard summary (all invoices, not just a page)
// plus a derived `draftCount` for the "Következő lépések" card (dashboard
// §3.3). draftCount is read from the existing /api/invoices list endpoint's
// real `total` (an accurate SQL count, not a page size) — this file adds a
// derived field only; it never rewrites the summary aggregation math.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import type { DashboardSummary } from "@/lib/dashboard/summary";

type SummaryResponse = { summary: DashboardSummary };
type InvoicesTotalResponse = { total: number };

const EMPTY_SUMMARY: DashboardSummary = {
  revenue: 0,
  outstanding: 0,
  overdueTotal: 0,
  issuedTotal: 0,
  estimatedVat: 0,
  overdueCount: 0,
  oldestOverdueDays: 0,
  recentInvoices: [],
};

export function useDashboardSummary() {
  const [summary, setSummary] = React.useState<DashboardSummary>(EMPTY_SUMMARY);
  const [draftCount, setDraftCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, draftsData] = await Promise.all([
        apiFetch<SummaryResponse>("/api/dashboard/summary"),
        apiFetch<InvoicesTotalResponse>("/api/invoices?status=draft&limit=1"),
      ]);
      setSummary(summaryData.summary);
      setDraftCount(draftsData.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { summary, draftCount, loading, error, refresh };
}
