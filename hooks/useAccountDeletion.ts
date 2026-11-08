// hooks/useAccountDeletion.ts
// Status / request / cancel of the (feature-flagged) self-serve account
// deletion request. The server answers 404 while the flag is off.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";

export type AccountDeletionRequest = {
  id: string;
  status: string;
  requestedAt: string;
  scheduledFor: string;
};

export function useAccountDeletion() {
  const [request, setRequest] = React.useState<AccountDeletionRequest | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ request: AccountDeletionRequest | null }>("/api/account/deletion");
      setRequest(data.request?.status === "requested" ? data.request : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const requestDeletion = React.useCallback(async (reason?: string) => {
    await apiFetch("/api/account/deletion", {
      method: "POST",
      body: JSON.stringify({ confirm: true, reason: reason?.trim() || undefined }),
    });
    await refresh();
  }, [refresh]);

  const cancelRequest = React.useCallback(async () => {
    await apiFetch("/api/account/deletion", { method: "DELETE" });
    await refresh();
  }, [refresh]);

  return { request, loading, error, requestDeletion, cancelRequest, refresh };
}
