// hooks/usePartnerSuggestions.ts
// Partners already invoiced (GET /api/clients/suggestions) for the composer's
// partner field. An empty query loads the top few at once (shown on focus);
// typing is debounced. A failed request is simply "no suggestions" — it must
// never get in the way of typing a partner by hand.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import type { PartnerSuggestion } from "@/lib/clients/suggestions-core";

const DEBOUNCE_MS = 250;

export function usePartnerSuggestions(query: string, enabled: boolean) {
  const [suggestions, setSuggestions] = React.useState<PartnerSuggestion[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const q = query.trim();
    let cancelled = false;
    setLoading(true);
    const run = () =>
      apiFetch<{ suggestions: PartnerSuggestion[] }>(`/api/clients/suggestions?q=${encodeURIComponent(q)}`)
        .then((data) => {
          if (!cancelled) setSuggestions(data.suggestions ?? []);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    if (!q) {
      void run();
      return () => {
        cancelled = true;
      };
    }
    const timer = setTimeout(() => void run(), DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, enabled]);

  return { suggestions, loading };
}
