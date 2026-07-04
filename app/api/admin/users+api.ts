// app/api/admin/users+api.ts
// Admin: list all users and platform stats.
import {
  forbiddenResponse,
  requireAdminAccess,
} from "@/lib/api/permissions";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { getPlatformStats, listAllUsers } from "@/lib/admin/service";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const denied = requireAdminAccess(session);
  if (denied) return denied;

  const [users, stats] = await Promise.all([listAllUsers(), getPlatformStats()]);
  return jsonResponse({ users, stats });
}
