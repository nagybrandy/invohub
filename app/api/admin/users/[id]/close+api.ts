// app/api/admin/users/[id]/close+api.ts
// Admin: close a user's account on an erasure / account-deletion request.
// Never hard-deletes — issued invoices are retained for 8 years (Áfa tv.
// 179. §, Számv. tv. 169. § (2); GDPR Art. 17(3)(b)). See
// lib/account/closure.ts and
// docs/decisions/2026-09-22-invoice-retention-on-account-deletion.md.
import { forbiddenResponse, requireAdminAccess } from "@/lib/api/permissions";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { closeAccount } from "@/lib/account/closure";

type Params = { id: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const denied = requireAdminAccess(session);
  if (denied) return denied;

  const id = await resolveIdParam(request, params);
  if (!id) return jsonResponse({ error: "User id is required." }, 400);

  if (id === session.user.id) {
    return forbiddenResponse("You cannot close your own admin account.");
  }

  let body: { confirm?: unknown } = {};
  try {
    body = (await request.json()) as { confirm?: unknown };
  } catch {
    body = {};
  }
  // Irreversible (login + personal data are gone) — require explicit intent.
  if (body.confirm !== true) {
    return jsonResponse({ error: "Set confirm: true to close this account." }, 400);
  }

  try {
    const result = await closeAccount(id);
    if (result.status === "not_found") {
      return jsonResponse({ error: "User not found." }, 404);
    }
    return jsonResponse({
      status: result.status,
      closedAt: result.closedAt.toISOString(),
      retentionUntil: result.retentionUntil ? result.retentionUntil.toISOString() : null,
    });
  } catch (error) {
    console.error("[POST /api/admin/users/:id/close]", error);
    return jsonResponse({ error: "Account closure failed." }, 500);
  }
}
