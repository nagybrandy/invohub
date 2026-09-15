// components/navigation/useSidebarCollapsed.ts
// Desktop sidebar collapse/expand state, owned by AppShell so both
// AppSidebar (renders narrow/wide) and AppTopStrip (renders the toggle
// icon) stay in sync off one source of truth.
import * as React from "react";
import { isWeb } from "@/lib/platform";

const SIDEBAR_COLLAPSE_STORAGE_KEY = "invohub.sidebar.collapsed";
const COLLAPSED_DEFAULT_MIN_WIDTH = 1024;
const COLLAPSED_DEFAULT_MAX_WIDTH = 1280;

function readStoredCollapsed(): boolean | null {
  if (!isWeb() || typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return null;
  } catch {
    return null;
  }
}

function writeStoredCollapsed(value: boolean) {
  if (!isWeb() || typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Private browsing / quota exceeded — collapse state just won't persist.
  }
}

function defaultCollapsedForWidth(width: number): boolean {
  return width >= COLLAPSED_DEFAULT_MIN_WIDTH && width < COLLAPSED_DEFAULT_MAX_WIDTH;
}

export function useSidebarCollapsed(width: number) {
  const hasStoredPreference = React.useRef(readStoredCollapsed() !== null);
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    const stored = readStoredCollapsed();
    return stored ?? defaultCollapsedForWidth(width);
  });

  React.useEffect(() => {
    if (hasStoredPreference.current) return;
    setCollapsed(defaultCollapsedForWidth(width));
    // Only the width dependency should re-derive the default; once the user
    // makes an explicit choice, `hasStoredPreference` takes over instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      hasStoredPreference.current = true;
      writeStoredCollapsed(next);
      return next;
    });
  }, []);

  return { collapsed, toggleCollapsed };
}
