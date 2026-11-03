// components/navigation/useSidebarCollapsed.ts
// Desktop sidebar collapse/expand state, owned by AppShell and passed to
// AppSidebar (which renders narrow/wide and hosts the toggle in its head).
import * as React from "react";
import { isWeb } from "@/lib/platform";
import { LAYOUT } from "@/lib/theme/layout";

const SIDEBAR_COLLAPSE_STORAGE_KEY = "invohub.sidebar.collapsed";

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

// SPEC §3: the 72px rail is the default for the tablet range (701-1099); the
// expanded 248px sidebar is the default from 1100. A stored choice always wins.
function defaultCollapsedForWidth(width: number): boolean {
  return width > LAYOUT.phoneMax && width < LAYOUT.wideMin;
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
