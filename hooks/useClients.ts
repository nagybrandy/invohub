// hooks/useClients.ts
// Client list hook backed by the API.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import type { Client, ClientInput } from "@/lib/clients/service";

type ClientsResponse = { clients: Client[] };
type ClientResponse = { client: Client };

export function useClients() {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ClientsResponse>("/api/clients");
      setClients(data.clients);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clients.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = React.useCallback(
    async (input: ClientInput) => {
      const data = await apiFetch<ClientResponse>("/api/clients", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await refresh();
      return data.client;
    },
    [refresh]
  );

  const update = React.useCallback(
    async (id: string, input: Partial<ClientInput>) => {
      const data = await apiFetch<ClientResponse>(`/api/clients/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      await refresh();
      return data.client;
    },
    [refresh]
  );

  const getById = React.useCallback(async (id: string) => {
    const data = await apiFetch<ClientResponse>(`/api/clients/${id}`);
    return data.client;
  }, []);

  const remove = React.useCallback(
    async (id: string) => {
      await apiFetch(`/api/clients/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh]
  );

  return { clients, loading, error, refresh, create, update, getById, remove };
}
