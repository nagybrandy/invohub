// hooks/useInvoiceStatusCounts.ts
// Per-status invoice counts for the filter chips on /invoices (L5 — every
// chip shows a count, including "Összes"). Uses the existing /api/invoices
// list endpoint's real `total` per status (limit=1, so the payload stays
// tiny) — no new backend aggregation, no change to invoice math.
//
// Fetches its OWN unfiltered grand total rather than accepting one from the
// caller: the caller's `total` comes from whichever status filter is
// currently active on /invoices, so reusing it here would make the
// "Összes" chip show the count of the currently selected filter instead of
// every invoice.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import type { InvoiceStatus } from "@/lib/invoices/types";

const TRACKED_STATUSES: InvoiceStatus[] = ["draft", "sent", "unpaid", "overdue", "paid"];

type InvoicesTotalResponse = { total: number };

export function useInvoiceStatusCounts() {
  const [counts, setCounts] = React.useState<Partial<Record<InvoiceStatus, number>>>({});
  const [allCount, setAllCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiFetch<InvoicesTotalResponse>("/api/invoices?limit=1").then((data) => data.total),
      Promise.all(
        TRACKED_STATUSES.map((status) =>
          apiFetch<InvoicesTotalResponse>(`/api/invoices?status=${status}&limit=1`).then(
            (data) => [status, data.total] as const
          )
        )
      ),
    ])
      .then(([total, entries]) => {
        if (cancelled) return;
        setAllCount(total);
        setCounts(Object.fromEntries(entries) as Partial<Record<InvoiceStatus, number>>);
      })
      .catch(() => {
        if (!cancelled) {
          setAllCount(0);
          setCounts({});
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const known = TRACKED_STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
  const other = Math.max(0, allCount - known);

  return { counts, allCount, other, loading };
}
