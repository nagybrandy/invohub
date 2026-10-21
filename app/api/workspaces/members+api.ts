// app/api/workspaces/members+api.ts
// Who has access to the CURRENT billing account (owner/admin only — enforced
// centrally by requireSession + lib/workspaces/permissions.ts).
import { jsonResponse, requireActor, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { listMembers } from "@/lib/workspaces/service";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();
  const actor = await requireActor(request);
  const members = await listMembers(session.user.id, actor?.user.id ?? session.user.id);
  return jsonResponse({ members });
}
