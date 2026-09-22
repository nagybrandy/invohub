// app/api/invoices/[id]/preview+api.ts
// Returns HTML preview for an invoice — branded with the user's own company
// (issuer block) and PDF template accent color (see
// docs/plans/2026-09-15-hungarianize-brand-invoice-preview-pdf.md, AC19).
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { buildInvoicePdfContext } from "@/lib/invoices/build-pdf-context";
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

  const { company, template, buyer } = await buildInvoicePdfContext(session.user.id, invoice);
  const html = generateInvoicePreviewHtml(invoice, { company, template, buyer });
  return jsonResponse({ html, invoice });
}
