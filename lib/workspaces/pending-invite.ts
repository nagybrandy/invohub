// lib/workspaces/pending-invite.ts
// An invitation link opened while signed out: keep its token until the person
// has signed in (or registered), then the app shell resumes it.
const KEY = "invohub.pendingInvite";

function read(): string | null {
  try {
    const s = typeof window !== "undefined" ? window.localStorage : null;
    return s && typeof s.getItem === "function" ? s.getItem(KEY) : null;
  } catch {
    return null;
  }
}

function write(token: string | null): void {
  try {
    const s = typeof window !== "undefined" ? window.localStorage : null;
    if (!s || typeof s.setItem !== "function") return;
    if (token === null) s.removeItem(KEY);
    else s.setItem(KEY, token);
  } catch {
    /* storage blocked */
  }
}

export const rememberPendingInvite = (token: string): void => write(token);
export const takePendingInvite = (): string | null => read();
export const clearPendingInvite = (): void => write(null);
