// hooks/useCompanySearch.ts
// Debounced search among Hungarian companies for the invoice's partner field
// (GET /api/company/search): an adószám is answered by NAV, a name by the
// configured registry provider. A failed or empty search is simply "no
// results" — it must never get in the way of typing a partner by hand.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import type { CompanySearchResponse, CompanySearchResult } from "@/lib/company/search";

const DEBOUNCE_MS = 350;
const MIN_LENGTH = 3;

export function useCompanySearch(query: string, enabled: boolean) {
  const [results, setResults] = React.useState<CompanySearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const q = query.trim();
    if (!enabled || q.length < MIN_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      apiFetch<CompanySearchResponse>(`/api/company/search?q=${encodeURIComponent(q)}`)
        .then((data) => {
          if (!cancelled) setResults(data.results ?? []);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, enabled]);

  return { results, loading };
}
