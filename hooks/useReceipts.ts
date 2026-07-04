// hooks/useReceipts.ts
// Receipt list hook backed by the API.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import type { ReceiptRecord } from "@/lib/receipts/service";

type ReceiptsResponse = { receipts: ReceiptRecord[] };

export function useReceipts() {
  const [receipts, setReceipts] = React.useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ReceiptsResponse>("/api/receipts");
      setReceipts(data.receipts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load receipts.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { receipts, loading, error, refresh };
}
