// app/api/invoices/[id]/storno+api.ts
// Create a storno (cancellation) invoice from an existing one, and flip the
// original invoice to status "cancelled" (see lib/invoices/service.ts).
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { createStornoInvoice, getInvoiceById } from "@/lib/invoices/service";

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
  if (existing.documentType === "proforma") {
    return jsonResponse({ code: "proformaNotStornoable" }, 400);
  }
  if (existing.status === "cancelled") {
    return jsonResponse({ error: "Invoice is already cancelled." }, 400);
  }

  const saved = await createStornoInvoice(session.user.id, existing);
  return jsonResponse({ invoice: saved }, 201);
}
