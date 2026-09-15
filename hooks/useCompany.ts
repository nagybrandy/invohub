// hooks/useCompany.ts
// Company profile hook backed by the API.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import type { CompanyInput } from "@/lib/companies/service";
import type { PublicCompany } from "@/lib/companies/public-company";
import type { InvoiceCurrency, PaymentMethod } from "@/lib/invoices/types";

/**
 * Invoice-composer defaults the company profile doesn't persist yet
 * (docs/design/app-ux-spec-2026-09-14.md §2.3). Read optionally — a
 * `company` without these fields on the wire just yields `undefined`, and
 * callers fall back to the composer's own defaults. No `db/schema.ts` or
 * API change; a future queue item adds real persistence.
 */
export type CompanyComposerDefaults = {
  defaultCurrency?: InvoiceCurrency;
  defaultPaymentMethod?: PaymentMethod;
  defaultPaymentTermDays?: number;
};

export type CompanyWithComposerDefaults = PublicCompany & CompanyComposerDefaults;

type CompanyResponse = { company: CompanyWithComposerDefaults | null };

export function useCompany() {
  const [company, setCompany] = React.useState<CompanyWithComposerDefaults | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<CompanyResponse>("/api/companies");
      setCompany(data.company);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load company.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = React.useCallback(
    async (input: CompanyInput) => {
      const data = await apiFetch<{ company: CompanyWithComposerDefaults }>("/api/companies", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setCompany(data.company);
      return data.company;
    },
    []
  );

  const lookup = React.useCallback(async (taxNumber: string) => {
    return apiFetch<{ company: CompanyInput | null }>(
      `/api/company/lookup?taxNumber=${encodeURIComponent(taxNumber)}`
    );
  }, []);

  return { company, loading, error, refresh, save, lookup };
}
