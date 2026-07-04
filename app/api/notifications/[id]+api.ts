// app/api/notifications/[id]+api.ts
// Mark a single notification as read.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { markNotificationRead } from "@/lib/notifications/service";

type Params = { id: string };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const updated = await markNotificationRead(session.user.id, id);
  if (!updated) return jsonResponse({ error: "Not found" }, 404);
  return jsonResponse({ notification: updated });
}
