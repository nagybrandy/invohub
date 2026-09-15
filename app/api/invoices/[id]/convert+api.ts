// app/api/invoices/[id]/convert+api.ts
// "Számla készítése ebből" — converts a paid díjbekérő (proforma) into a
// draft invoice. Refuses a non-proforma or a cancelled proforma (400), and
// refuses converting the same proforma twice while a live conversion exists
// (409, carrying the existing invoice) — see lib/invoices/convert-proforma.ts.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { canConvertProforma } from "@/lib/invoices/convert-proforma";
import {
  convertProformaToInvoice,
  findExistingConversion,
  getInvoiceById,
} from "@/lib/invoices/service";

type Params = { id: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const id = await resolveIdParam(request, params);
  const existing = await getInvoiceById(session.user.id, id);
  if (!existing) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  const canConvert = canConvertProforma(existing);
  if (!canConvert.ok) {
    return jsonResponse({ code: canConvert.reason }, 400);
  }

  const existingConversion = await findExistingConversion(session.user.id, existing.id);
  if (existingConversion) {
    return jsonResponse(
      { code: "alreadyConverted", invoice: existingConversion },
      409
    );
  }

  const invoice = await convertProformaToInvoice(session.user.id, existing);
  return jsonResponse({ invoice }, 201);
}
