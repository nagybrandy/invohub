// hooks/useM2mDemo.ts
// Loads a NAV M2M Adózó snapshot from the API — the real test-env call when
// the owner has configured M2M_* env vars, the in-process demo simulator
// otherwise (always succeeds, zero setup needed).
import * as React from "react";
import { apiFetch } from "@/lib/api/client";
import type { M2mDemoSnapshot } from "@/lib/m2m/demo-user";

type M2mDemoMode = "demo" | "test";

type M2mDemoResponse = {
  snapshot?: M2mDemoSnapshot;
  configured?: boolean;
  mode?: M2mDemoMode;
  error?: string;
};

export function useM2mDemo() {
  const [snapshot, setSnapshot] = React.useState<M2mDemoSnapshot | null>(null);
  const [mode, setMode] = React.useState<M2mDemoMode>("demo");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (seed?: number) => {
    setLoading(true);
    setError(null);
    try {
      const query = seed != null ? `?seed=${seed}` : "";
      const data = await apiFetch<M2mDemoResponse>(`/api/m2m/demo${query}`);
      if (data.error) {
        setError(data.error);
        setSnapshot(null);
        return null;
      }
      setSnapshot(data.snapshot ?? null);
      setMode(data.mode ?? "demo");
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

  return { snapshot, mode, loading, error, load };
}
