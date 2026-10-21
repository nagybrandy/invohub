// lib/workspaces/active-client.ts
// The browser side of the billing-account selection (see active-account.ts for
// the server side). The id is kept in localStorage and mirrored into a cookie
// so iframes / downloads / plain links carry it too. Web only; on native the
// selection is not persisted yet and the person's own account is used.
import { ACTIVE_ACCOUNT_COOKIE, isPlausibleAccountId } from "@/lib/workspaces/active-account";

const STORAGE_KEY = "invohub.activeAccount";

let memory: string | null | undefined;

function hasDom(): boolean {
  return typeof document !== "undefined" && typeof window !== "undefined";
}

/** The selected billing account id, or null for the person's own account. */
export function getActiveAccountId(): string | null {
  if (memory !== undefined) return memory;
  let value: string | null = null;
  if (hasDom()) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      value = isPlausibleAccountId(stored) ? stored : null;
    } catch {
      value = null;
    }
  }
  memory = value;
  return value;
}

/** Selects an account (null = own). Does not reload — callers decide how to refresh. */
export function setActiveAccountId(id: string | null): void {
  memory = id && isPlausibleAccountId(id) ? id : null;
  if (!hasDom()) return;
  try {
    if (memory) window.localStorage.setItem(STORAGE_KEY, memory);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage blocked: the cookie below still works */
  }
  const secure = window.location?.protocol === "https:" ? "; Secure" : "";
  document.cookie = memory
    ? `${ACTIVE_ACCOUNT_COOKIE}=${encodeURIComponent(memory)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
    : `${ACTIVE_ACCOUNT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

/** Test hook. */
export function resetActiveAccountMemory(): void {
  memory = undefined;
}
