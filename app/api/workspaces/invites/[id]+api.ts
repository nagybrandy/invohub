// app/api/workspaces/invites/[id]+api.ts
// Withdraw a pending invitation (owner/admin only).
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { revokeInvite } from "@/lib/workspaces/service";

type Params = { id: string };

export async function DELETE(request: Request, { params }: { params: Promise<Params> }) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();
  const id = await resolveIdParam(request, params);
  if (!id) return jsonResponse({ error: "Not found" }, 404);
  const ok = await revokeInvite(session.user.id, id);
  return ok ? jsonResponse({ ok: true }) : jsonResponse({ error: "Not found" }, 404);
}
