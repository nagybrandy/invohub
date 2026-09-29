// app/api/v1/invoices/[id]/pdf+api.ts
// External API: same PDF generator as app/api/invoices/[id]/pdf+api.ts,
// scoped to the key's userId.
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
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
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const id = await resolveIdParam(request, params);
  const invoice = await getInvoiceById(auth.userId, id);
  if (!invoice) {
    return Response.json({ error: "Invoice not found." }, { status: 404 });
  }

  const ctx = await buildInvoicePdfContext(auth.userId, invoice);
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
