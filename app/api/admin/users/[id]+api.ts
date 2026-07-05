// app/api/admin/users/[id]+api.ts
// Admin: update a user's role.
import {
  forbiddenResponse,
  requireAdminAccess,
} from "@/lib/api/permissions";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { updateUserRole } from "@/lib/admin/service";

type Params = { id: string };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const denied = requireAdminAccess(session);
  if (denied) return denied;

  const id = await resolveIdParam(request, params);
  const body = (await request.json()) as { role?: string };

  if (!body.role?.trim()) {
    return jsonResponse({ error: "role is required." }, 400);
  }

  if (id === session.user.id && body.role !== "admin") {
    return forbiddenResponse("You cannot remove your own admin role.");
  }

  try {
    const user = await updateUserRole(id, body.role.trim());
    if (!user) return jsonResponse({ error: "User not found." }, 404);
    return jsonResponse({ user });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed.";
    return jsonResponse({ error: message }, 400);
  }
}
