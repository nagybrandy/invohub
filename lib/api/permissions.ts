// lib/api/permissions.ts
// Role-based API access checks.
import { canAccessAdminPanel, canManageClients } from "@/lib/user-roles";

type SessionUser = { id: string; role?: string | null };

export type AuthSession = { user: SessionUser };

export function getSessionRole(session: AuthSession): string {
  return session.user.role ?? "entrepreneur";
}

export function forbiddenResponse(message = "Forbidden") {
  return Response.json({ error: message }, { status: 403 });
}

export function requireAccountantAccess(session: AuthSession): Response | null {
  if (!canManageClients(getSessionRole(session))) {
    return forbiddenResponse("Business account access required.");
  }
  return null;
}

export function requireAdminAccess(session: AuthSession): Response | null {
  if (!canAccessAdminPanel(getSessionRole(session))) {
    return forbiddenResponse("Admin access required.");
  }
  return null;
}
