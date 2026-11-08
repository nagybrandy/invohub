// hooks/useRecurringInvoices.ts
// Recurring invoice templates backed by /api/recurring-invoices (scoped to the
// active billing account server-side).
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import type { RecurrenceFrequency } from "@/lib/recurring/schedule";
import type { RecurringTemplate, TemplatePatch } from "@/lib/recurring/service";

type ListResponse = { templates: RecurringTemplate[] };
type OneResponse = { template: RecurringTemplate };

export type CreateRecurringInput = {
  sourceInvoiceId: string;
  name?: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string | null;
  maxOccurrences?: number | null;
};

export function useRecurringInvoices() {
  const [templates, setTemplates] = React.useState<RecurringTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ListResponse>("/api/recurring-invoices");
      setTemplates(data.templates);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load recurring invoices.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = React.useCallback(async (input: CreateRecurringInput) => {
    const data = await apiFetch<OneResponse>("/api/recurring-invoices", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return data.template;
  }, []);

  const getById = React.useCallback(async (id: string) => {
    const data = await apiFetch<OneResponse>(`/api/recurring-invoices/${id}`);
    return data.template;
  }, []);

  const update = React.useCallback(
    async (id: string, patch: TemplatePatch) => {
      const data = await apiFetch<OneResponse>(`/api/recurring-invoices/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await refresh();
      return data.template;
    },
    [refresh]
  );

  const remove = React.useCallback(
    async (id: string) => {
      await apiFetch(`/api/recurring-invoices/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh]
  );

  return { templates, loading, error, refresh, create, getById, update, remove };
}
