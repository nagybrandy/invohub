// app/api/invoices/[id]/storno+api.ts
// Create a storno (cancellation) invoice from an existing one, and flip the
// original invoice to status "cancelled" — guard + orchestration shared
// with the external v1 route via lib/invoices/storno-handler.ts.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { performStorno } from "@/lib/invoices/storno-handler";

type Params = { id: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const id = await resolveIdParam(request, params);
  const result = await performStorno(session.user.id, id);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return jsonResponse({ error: "Not found" }, 404);
    }
    if (result.reason === "proforma") {
      return jsonResponse({ code: "proformaNotStornoable" }, 400);
    }
    return jsonResponse({ error: "Invoice is already cancelled." }, 400);
  }

  return jsonResponse({ invoice: result.invoice }, 201);
}
