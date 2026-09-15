// hooks/useDashboardSummary.ts
// Loads the SQL-aggregated dashboard summary (all invoices, not just a page)
// plus a few derived fields for the redesigned dashboard (§3.3): `draftCount`
// and `navPendingCount` for the "Következő lépések" card, and
// `outstandingCount`/`paidCount` as KPI hints. Every count here is read from
// the existing /api/invoices list endpoint's real `total` (an accurate SQL
// count, not a page size) — this file adds derived fields only; it never
// rewrites the summary aggregation math in lib/dashboard/summary.ts.
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

const OUTSTANDING_KPI_STATUSES = ["sent", "unpaid", "overdue", "partially_paid"] as const;

async function countFor(status: string): Promise<number> {
  const data = await apiFetch<InvoicesTotalResponse>(`/api/invoices?status=${status}&limit=1`);
  return data.total;
}

export function useDashboardSummary() {
  const [summary, setSummary] = React.useState<DashboardSummary>(EMPTY_SUMMARY);
  const [draftCount, setDraftCount] = React.useState(0);
  const [outstandingCount, setOutstandingCount] = React.useState(0);
  const [paidCount, setPaidCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, draftsTotal, paidTotal, ...outstandingTotals] = await Promise.all([
        apiFetch<SummaryResponse>("/api/dashboard/summary"),
        countFor("draft"),
        countFor("paid"),
        ...OUTSTANDING_KPI_STATUSES.map(countFor),
      ]);
      setSummary(summaryData.summary);
      setDraftCount(draftsTotal);
      setPaidCount(paidTotal);
      setOutstandingCount(outstandingTotals.reduce((sum, n) => sum + n, 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { summary, draftCount, outstandingCount, paidCount, loading, error, refresh };
}
