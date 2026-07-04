// app/api/notifications+api.ts
// List notifications and sync from domain state.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import {
  getUnreadCount,
  listNotifications,
  syncNotificationsFromDomain,
} from "@/lib/notifications/service";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const url = new URL(request.url);
  const shouldSync = url.searchParams.get("sync") === "1";

  if (shouldSync) {
    await syncNotificationsFromDomain(session.user.id);
  }

  const [notifications, unreadCount] = await Promise.all([
    listNotifications(session.user.id),
    getUnreadCount(session.user.id),
  ]);

  return jsonResponse({ notifications, unreadCount });
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  await syncNotificationsFromDomain(session.user.id);
  const [notifications, unreadCount] = await Promise.all([
    listNotifications(session.user.id),
    getUnreadCount(session.user.id),
  ]);

  return jsonResponse({ notifications, unreadCount });
}
