// app/api/workspaces/leave+api.ts
// A person gives up their own access to a billing account (not as its owner).
import { jsonResponse, requireActor, unauthorizedResponse } from "@/lib/api/session";
import { leaveAccount } from "@/lib/workspaces/service";

export async function POST(request: Request) {
  const session = await requireActor(request);
  if (!session) return unauthorizedResponse();
  const body = (await request.json().catch(() => ({}))) as { accountId?: unknown };
  if (typeof body.accountId !== "string") return jsonResponse({ error: "accountId is required.", code: "invalid" }, 400);
  const left = await leaveAccount(session.user.id, body.accountId);
  return left ? jsonResponse({ ok: true }) : jsonResponse({ error: "Nothing to leave.", code: "notFound" }, 404);
}
