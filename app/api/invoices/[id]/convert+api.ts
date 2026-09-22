// app/api/invoices/[id]/convert+api.ts
// "Számla készítése ebből" — converts a paid díjbekérő (proforma) into a
// draft invoice. Refuses a non-proforma or a cancelled proforma (400), and
// refuses converting the same proforma twice while a live conversion exists
// (409, carrying the existing invoice) — guard + race handling shared with
// the external v1 route via lib/invoices/convert-handler.ts.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { performConvert } from "@/lib/invoices/convert-handler";

type Params = { id: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const id = await resolveIdParam(request, params);
  const result = await performConvert(session.user.id, id);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return jsonResponse({ error: "Not found" }, 404);
    }
    if (result.reason === "already_converted") {
      return jsonResponse({ code: "alreadyConverted", invoice: result.invoice }, 409);
    }
    return jsonResponse({ code: result.reason }, 400);
  }

  return jsonResponse({ invoice: result.invoice }, 201);
}
