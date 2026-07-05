// app/api/invoices/[id]/preview+api.ts
// Returns HTML preview for an invoice.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { generateInvoicePreviewHtml } from "@/lib/invoices/preview-html";
import { getInvoiceById } from "@/lib/invoices/service";

type Params = { id: string };

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const id = await resolveIdParam(request, params);
  const invoice = await getInvoiceById(session.user.id, id);
  if (!invoice) return jsonResponse({ error: "Not found" }, 404);

  const html = generateInvoicePreviewHtml(invoice);
  return jsonResponse({ html, invoice });
}
