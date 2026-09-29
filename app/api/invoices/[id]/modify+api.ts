// app/api/invoices/[id]/modify+api.ts
// Starts a helyesbítő (correction) draft prefilled with the original's
// lines — guard + orchestration shared with the external v1 route via
// lib/invoices/modify-handler.ts.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { performModify } from "@/lib/invoices/modify-handler";

type Params = { id: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const id = await resolveIdParam(request, params);
  const result = await performModify(session.user.id, id);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return jsonResponse({ error: "Not found" }, 404);
    }
    return jsonResponse({ code: "proformaNotStornoable" }, 400);
  }

  return jsonResponse({ invoice: result.invoice }, 201);
}
