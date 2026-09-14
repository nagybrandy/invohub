// app/api/invoices/[id]/links+api.ts
// Storno/helyesbítő links for the invoice detail screen: the document this
// one cancels/corrects (forward links, on the invoice itself) plus any
// documents that cancel/correct THIS one (reverse links, looked up by id).
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { findInvoicesReferencing, getInvoiceById } from "@/lib/invoices/service";

type Params = { id: string };

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const id = await resolveIdParam(request, params);
  const invoice = await getInvoiceById(session.user.id, id);
  if (!invoice) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  const [originalInvoice, modifiesInvoice, stornoDocuments, correctionDocuments] =
    await Promise.all([
      invoice.originalInvoiceId
        ? getInvoiceById(session.user.id, invoice.originalInvoiceId)
        : Promise.resolve(null),
      invoice.modifiesInvoiceId
        ? getInvoiceById(session.user.id, invoice.modifiesInvoiceId)
        : Promise.resolve(null),
      findInvoicesReferencing(session.user.id, "originalInvoiceId", id),
      findInvoicesReferencing(session.user.id, "modifiesInvoiceId", id),
    ]);

  return jsonResponse({
    originalInvoice,
    modifiesInvoice,
    stornoDocuments,
    correctionDocuments,
  });
}
