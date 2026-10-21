// lib/api/session.ts
// Resolves the authenticated user from an API request via Better Auth — and,
// when the person has selected another billing account they may work in,
// points `session.user.id` at THAT account. Every route uses session.user.id
// as the owner of the data it reads and writes, so one swap here scopes the
// whole API; what the person may do there is decided by role
// (lib/workspaces/permissions.ts) before the route even runs.
import { auth } from "@/lib/auth";
import { SELF_ACCOUNT, readActiveAccount } from "@/lib/workspaces/active-account";
import { canPerform, isPlatformPath, type WorkspaceRole } from "@/lib/workspaces/permissions";
import { getAccountRole } from "@/lib/workspaces/service";

export async function requireSession(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return null;
  }

  const requested = readActiveAccount(request.headers);
  if (!requested || requested === SELF_ACCOUNT || requested === session.user.id) return session;

  const { pathname } = new URL(request.url);
  // Platform administration acts on the person, whatever account is selected.
  if (isPlatformPath(pathname)) return session;

  const access = await getAccountRole(session.user.id, requested);
  // No access (or a closed account): refuse rather than silently fall back to
  // the person's own data — the caller would believe it is somewhere it is not.
  if (!access || !canPerform(access.role, request.method, pathname)) return null;

  return {
    ...session,
    user: { ...session.user, id: requested, name: access.name, role: "entrepreneur" },
    /** Who is really signed in, and in which role they are working here. */
    scope: { accountId: requested, role: access.role as WorkspaceRole, actorId: session.user.id },
  };
}

/** The caller's role in the selected billing account; the account's own person (no scope) is its owner. */
export function sessionRole(session: unknown): WorkspaceRole {
  return (session as { scope?: { role?: WorkspaceRole } } | null)?.scope?.role ?? "owner";
}

/** The signed-in person themself, ignoring any selected billing account (for account management). */
export async function requireActor(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ? session : null;
}

export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}
