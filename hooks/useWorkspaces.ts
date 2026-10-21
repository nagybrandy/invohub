// hooks/useWorkspaces.ts
// The billing accounts the signed-in person can work in, which one is active,
// and switching between them. Web switching reloads the page: every screen
// then loads the other account's data from scratch, with no stale state from
// the previous one left on screen.
import * as React from "react";
import { Platform } from "react-native";
import { apiFetch } from "@/lib/api/client";
import { getActiveAccountId, setActiveAccountId } from "@/lib/workspaces/active-client";
import type { WorkspaceRole } from "@/lib/workspaces/permissions";
import type { AccountSummary } from "@/lib/workspaces/service";

type WorkspacesResponse = { accounts: AccountSummary[]; activeId: string };

export type UseWorkspaces = {
  accounts: AccountSummary[];
  active: AccountSummary | null;
  /** The person's role in the active account ("owner" in their own). */
  role: WorkspaceRole;
  /** True when working in an account that is not the person's own. */
  inForeignAccount: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  switchTo: (accountId: string | null) => void;
  create: (name: string) => Promise<{ id: string; name: string }>;
};

export function useWorkspaces(): UseWorkspaces {
  const [accounts, setAccounts] = React.useState<AccountSummary[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const data = await apiFetch<WorkspacesResponse>("/api/workspaces");
      setAccounts(data.accounts);
      setActiveId(data.activeId);
      // A stale selection (access revoked, account gone) falls back to the own account.
      const selected = getActiveAccountId();
      if (selected && !data.accounts.some((a) => a.id === selected)) setActiveAccountId(null);
    } catch {
      /* not signed in / offline: no switcher */
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchTo = React.useCallback((accountId: string | null) => {
    setActiveAccountId(accountId);
    if (Platform.OS === "web" && typeof window !== "undefined") window.location.assign("/dashboard");
  }, []);

  const create = React.useCallback(
    async (name: string) => {
      const data = await apiFetch<{ workspace: { id: string; name: string } }>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      await refresh();
      return data.workspace;
    },
    [refresh],
  );

  const active = accounts.find((a) => a.id === activeId) ?? accounts[0] ?? null;
  return {
    accounts,
    active,
    role: active?.role ?? "owner",
    inForeignAccount: Boolean(active && !active.isOwn),
    loading,
    refresh,
    switchTo,
    create,
  };
}
