// hooks/useTaxpayerLookup.ts
// NAV taxpayer lookup for any tax number (GET /api/company/lookup) — the
// partner forms use it to fill name and address instead of retyping them.
// The route answers from NAV in test/production mode and from deterministic
// demo taxpayers otherwise, so the hook never knows which it got.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";

export type TaxpayerLookupResult = {
  name?: string;
  address?: string;
  city?: string;
  zipCode?: string;
};

type LookupResponse = { company: TaxpayerLookupResult | null };

export function useTaxpayerLookup() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const lookup = React.useCallback(async (taxNumber: string): Promise<TaxpayerLookupResult | null> => {
    const value = taxNumber.trim();
    if (!value) return null;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<LookupResponse>(
        `/api/company/lookup?taxNumber=${encodeURIComponent(value)}`,
      );
      return response.company;
    } catch (e) {
      setError(e instanceof Error ? e.message : "lookupFailed");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { lookup, loading, error };
}
