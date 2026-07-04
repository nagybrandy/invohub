// app/api/notifications/read-all+api.ts
// Mark all notifications as read.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { markAllNotificationsRead } from "@/lib/notifications/service";

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const count = await markAllNotificationsRead(session.user.id);
  return jsonResponse({ marked: count });
}
