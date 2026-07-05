// lib/routing/route-param.ts
// Reads dynamic route params on web when Expo Router search params are empty.
import { useGlobalSearchParams, useLocalSearchParams, usePathname } from "expo-router";
import * as React from "react";

const APP_ID_PATTERNS = [
  /^\/invoices\/([^/]+)/,
  /^\/receipts\/([^/]+)/,
  /^\/clients\/([^/]+)/,
  /^\/products\/([^/]+)/,
] as const;

const RESERVED_SEGMENTS = new Set(["new", "edit"]);

function normalizeParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined;
  }
  return value?.trim() || undefined;
}

export function idFromAppPathname(pathname: string): string | undefined {
  for (const pattern of APP_ID_PATTERNS) {
    const match = pathname.match(pattern);
    const candidate = match?.[1] ? decodeURIComponent(match[1]) : undefined;
    if (candidate && !RESERVED_SEGMENTS.has(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export function useRouteParam(name: string): string | undefined {
  const local = useLocalSearchParams<Record<string, string | string[]>>();
  const global = useGlobalSearchParams<Record<string, string | string[]>>();
  const pathname = usePathname();

  return React.useMemo(() => {
    const fromLocal = normalizeParam(local[name]);
    if (fromLocal) return fromLocal;

    const fromGlobal = normalizeParam(global[name]);
    if (fromGlobal) return fromGlobal;

    if (name === "id") {
      return idFromAppPathname(pathname);
    }

    return normalizeParam(local[name] ?? global[name]);
  }, [global, local, name, pathname]);
}
