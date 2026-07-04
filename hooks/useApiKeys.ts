// hooks/useApiKeys.ts
// API key management hook for external invoice integration.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import type { ApiKeyRecord, CreatedApiKey } from "@/lib/api-keys/service";

export function useApiKeys() {
  const [keys, setKeys] = React.useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ keys: ApiKeyRecord[] }>("/api/api-keys");
      setKeys(data.keys);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load API keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = React.useCallback(async (name: string) => {
    const data = await apiFetch<{ key: CreatedApiKey }>("/api/api-keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    await refresh();
    return data.key;
  }, [refresh]);

  const revoke = React.useCallback(
    async (id: string) => {
      await apiFetch(`/api/api-keys/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh]
  );

  return { keys, loading, error, refresh, create, revoke };
}
