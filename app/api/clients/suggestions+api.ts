// app/api/clients/suggestions+api.ts
// GET /api/clients/suggestions?q= — partners already invoiced by the ACTIVE
// billing account (requireSession points session.user.id at it), most recent
// first, with their usual invoice settings for the composer's prefill.
// Read-only.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { requireAccountantAccess } from "@/lib/api/permissions";
import { listPartnerSuggestions } from "@/lib/clients/suggestions";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const denied = requireAccountantAccess(session);
  if (denied) return denied;

  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 100);
  const suggestions = await listPartnerSuggestions(session.user.id, q);
  return jsonResponse({ suggestions });
}
