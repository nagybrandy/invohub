// hooks/useDashboardSummary.ts
// Loads the SQL-aggregated dashboard summary (all invoices, not just a page).
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import type { DashboardSummary } from "@/lib/dashboard/summary";

type SummaryResponse = { summary: DashboardSummary };

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
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<SummaryResponse>("/api/dashboard/summary");
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { summary, loading, error, refresh };
}
