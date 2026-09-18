// hooks/useMissingExchangeRateCount.ts
// The count of non-HUF invoices with no usable stored HUF exchange rate —
// drives the /invoices list banner (see lib/invoices/exchange-rate.ts,
// lib/invoices/list-query.ts). Mirrors hooks/useInvoiceStatusCounts.ts's
// pattern: one cheap limit=1 request for just the `total`, errors swallowed
// to 0 (a banner that fails to load should disappear, not crash the list),
// and a `cancelled` guard against setState after unmount.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";

type InvoicesTotalResponse = { total: number };

export function useMissingExchangeRateCount() {
  const [count, setCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch<InvoicesTotalResponse>("/api/invoices?needsExchangeRate=1&limit=1")
      .then((data) => {
        if (!cancelled) setCount(data.total);
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
