// app/api/invoices/[id]/pdf+api.ts
// Returns invoice as application/pdf for preview and download.
import { requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { buildInvoicePdfContext } from "@/lib/invoices/build-pdf-context";
import {
  generateInvoicePdf,
  invoicePdfFilename,
} from "@/lib/invoices/generate-pdf";
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
  if (!invoice) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ctx = await buildInvoicePdfContext(session.user.id, invoice);
  const pdf = await generateInvoicePdf(ctx);
  const filename = invoicePdfFilename(invoice.invoiceNumber);

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
