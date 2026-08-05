// hooks/useM2mDemo.ts
// Loads a random NAV M2M test taxpayer snapshot from the API.
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import type { M2mDemoSnapshot } from "@/lib/m2m/demo-user";

type M2mDemoResponse = {
  snapshot?: M2mDemoSnapshot;
  configured?: boolean;
  error?: string;
  hint?: string;
};

export function useM2mDemo() {
  const [snapshot, setSnapshot] = React.useState<M2mDemoSnapshot | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notConfigured, setNotConfigured] = React.useState(false);

  const load = React.useCallback(async (seed?: number) => {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const query = seed != null ? `?seed=${seed}` : "";
      const data = await apiFetch<M2mDemoResponse>(`/api/m2m/demo${query}`);
      if (data.error) {
        if (data.hint) setNotConfigured(true);
        setError(data.error);
        setSnapshot(null);
        return null;
      }
      setSnapshot(data.snapshot ?? null);
      return data.snapshot ?? null;
    } catch (e) {
      const message = e instanceof Error ? e.message : "M2M demo failed.";
      setError(message);
      setSnapshot(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { snapshot, loading, error, notConfigured, load };
}
