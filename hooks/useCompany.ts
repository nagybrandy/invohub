// hooks/useCompany.ts
// Company profile hook backed by the API.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import type { CompanyInput } from "@/lib/companies/service";
import type { PublicCompany } from "@/lib/companies/public-company";

type CompanyResponse = { company: PublicCompany | null };

export function useCompany() {
  const [company, setCompany] = React.useState<PublicCompany | null>(null);
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
      const data = await apiFetch<{ company: PublicCompany }>("/api/companies", {
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
