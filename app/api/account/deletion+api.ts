// app/api/account/deletion+api.ts
// Self-serve account deletion REQUEST (reversible): GET status, POST request,
// DELETE cancel. Feature-flagged OFF — with ACCOUNT_DELETION_ENABLED unset the
// route is a 404. It acts on the signed-in person's OWN account only
// (requireActor ignores any selected workspace) and never executes the
// closure; see docs/decisions/2026-11-08-self-serve-account-deletion.md.
import { jsonResponse, requireActor, unauthorizedResponse } from "@/lib/api/session";
import { isAccountDeletionEnabled } from "@/lib/account/deletion-flag";
import { cancelDeletionRequest, getDeletionStatus, requestDeletion } from "@/lib/account/deletion-request";

const notFound = () => Response.json({ error: "Not found" }, { status: 404 });

export async function GET(request: Request) {
  if (!isAccountDeletionEnabled()) return notFound();
  const session = await requireActor(request);
  if (!session) return unauthorizedResponse();
  const status = await getDeletionStatus(session.user.id);
  return jsonResponse({ enabled: true, ...status });
}

export async function POST(request: Request) {
  if (!isAccountDeletionEnabled()) return notFound();
  const session = await requireActor(request);
  if (!session) return unauthorizedResponse();
  const body = (await request.json().catch(() => ({}))) as { confirm?: unknown; reason?: unknown };
  if (body.confirm !== true) {
    return jsonResponse({ error: "Explicit confirmation is required.", code: "confirmRequired" }, 400);
  }
  const reason = typeof body.reason === "string" ? body.reason : undefined;
  const result = await requestDeletion({ userId: session.user.id, reason });
  return jsonResponse(result, result.alreadyRequested ? 200 : 201);
}

export async function DELETE(request: Request) {
  if (!isAccountDeletionEnabled()) return notFound();
  const session = await requireActor(request);
  if (!session) return unauthorizedResponse();
  const cancelled = await cancelDeletionRequest({ userId: session.user.id });
  return cancelled
    ? jsonResponse(cancelled)
    : jsonResponse({ error: "No open request.", code: "notFound" }, 404);
}
