// app/api/workspaces/invites/accept+api.ts
// The signed-in person accepts an invitation from the e-mailed link. The
// invitation is addressed to one e-mail: only that address can accept it.
import { jsonResponse, requireActor, unauthorizedResponse } from "@/lib/api/session";
import { acceptInvite } from "@/lib/workspaces/service";

export async function POST(request: Request) {
  const session = await requireActor(request);
  if (!session) return unauthorizedResponse();
  const body = (await request.json().catch(() => ({}))) as { token?: unknown };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return jsonResponse({ error: "token is required.", code: "notFound" }, 400);

  const result = await acceptInvite(token, { id: session.user.id, email: session.user.email });
  if (!result.ok) {
    const status = result.reason === "notFound" ? 404 : result.reason === "wrongEmail" ? 403 : 410;
    return jsonResponse({ error: "Invitation cannot be accepted.", code: result.reason }, status);
  }
  return jsonResponse({ accountId: result.accountId, accountName: result.accountName, role: result.role });
}
