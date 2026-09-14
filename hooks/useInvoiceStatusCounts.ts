// hooks/useInvoiceStatusCounts.ts
// Per-status invoice counts for the filter chips on /invoices (L5 — every
// chip shows a count). Uses the existing /api/invoices list endpoint's real
// `total` per status (limit=1, so the payload stays tiny) — no new backend
// aggregation, no change to invoice math.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import type { InvoiceStatus } from "@/lib/invoices/types";

const TRACKED_STATUSES: InvoiceStatus[] = ["draft", "sent", "unpaid", "overdue", "paid"];

type InvoicesTotalResponse = { total: number };

export function useInvoiceStatusCounts(totalCount: number) {
  const [counts, setCounts] = React.useState<Partial<Record<InvoiceStatus, number>>>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      TRACKED_STATUSES.map((status) =>
        apiFetch<InvoicesTotalResponse>(`/api/invoices?status=${status}&limit=1`).then(
          (data) => [status, data.total] as const
        )
      )
    )
      .then((entries) => {
        if (cancelled) return;
        setCounts(Object.fromEntries(entries) as Partial<Record<InvoiceStatus, number>>);
      })
      .catch(() => {
        if (!cancelled) setCounts({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const known = TRACKED_STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
  const other = Math.max(0, totalCount - known);

  return { counts, other, loading };
}
