// hooks/useNavFailedCount.ts
// How many of the user's invoices have a failed latest NAV submission — the
// count behind the list's "NAV-hiba" chip. Its own hook (not a sixth status
// in useInvoiceStatusCounts) because it is not a status: it is a NAV outcome.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";

export function useNavFailedCount() {
  const [count, setCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch<{ total: number }>("/api/invoices?navFailed=1&limit=1")
      .then((data) => {
        if (!cancelled) setCount(data.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { count, loading };
}
