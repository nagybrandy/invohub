// app/api/workspaces/members/[id]+api.ts
// Change a member's role or remove them (owner/admin only — see permissions.ts).
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { jsonResponse, requireSession, sessionRole, unauthorizedResponse } from "@/lib/api/session";
import { isInvitableRole } from "@/lib/workspaces/permissions";
import { AdminOnlyError, LastOwnerError, changeMemberRole, removeMember } from "@/lib/workspaces/service";

type Params = { id: string };

export async function PATCH(request: Request, { params }: { params: Promise<Params> }) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();
  const id = await resolveIdParam(request, params);
  const body = (await request.json().catch(() => ({}))) as { role?: unknown };
  if (!id || !isInvitableRole(body.role)) return jsonResponse({ error: "A valid role is required.", code: "invalidRole" }, 400);
  try {
    const ok = await changeMemberRole(session.user.id, id, body.role, sessionRole(session));
    return ok ? jsonResponse({ ok: true }) : jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof LastOwnerError) return jsonResponse({ error: "The owner cannot be changed.", code: "lastOwner" }, 409);
    if (error instanceof AdminOnlyError) return jsonResponse({ error: "Only the owner may manage administrators.", code: "adminOnly" }, 403);
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<Params> }) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();
  const id = await resolveIdParam(request, params);
  if (!id) return jsonResponse({ error: "Not found" }, 404);
  try {
    const ok = await removeMember(session.user.id, id, sessionRole(session));
    return ok ? jsonResponse({ ok: true }) : jsonResponse({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof LastOwnerError) return jsonResponse({ error: "The owner cannot be removed.", code: "lastOwner" }, 409);
    if (error instanceof AdminOnlyError) return jsonResponse({ error: "Only the owner may manage administrators.", code: "adminOnly" }, 403);
    throw error;
  }
}
