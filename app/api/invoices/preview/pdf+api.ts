// app/api/invoices/preview/pdf+api.ts
// Generates PDF for an unsaved invoice draft (new-invoice preview).
import { requireSession, unauthorizedResponse } from "@/lib/api/session";
import { buildInvoicePdfContext } from "@/lib/invoices/build-pdf-context";
import { generateInvoicePdf } from "@/lib/invoices/generate-pdf";
import type { Invoice } from "@/lib/invoices/types";

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as { invoice?: Invoice };
  if (!body.invoice?.lineItems?.length) {
    return new Response(JSON.stringify({ error: "Invoice with line items required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ctx = await buildInvoicePdfContext(session.user.id, body.invoice);
  const pdf = await generateInvoicePdf(ctx);

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="invoice-preview.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
