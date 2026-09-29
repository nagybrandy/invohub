// app/api/invoices/preview/pdf+api.ts
// Renders an UNSAVED composer payload to PDF for the live side preview —
// through the same buildInvoicePdfContext + generateInvoicePdf as the saved
// invoice's /api/invoices/[id]/pdf, so the preview is always exactly the
// document the customer receives (the user's company, PDF template and the
// linked partner's address, looked up under the session user only). The
// payload is parsed defensively and always rendered as an unnumbered draft
// (lib/invoices/draft-preview.ts). Nothing is persisted.
import { requireSession, unauthorizedResponse } from "@/lib/api/session";
import { buildInvoicePdfContext } from "@/lib/invoices/build-pdf-context";
import { parseDraftPreviewInvoice } from "@/lib/invoices/draft-preview";
import { generateInvoicePdf } from "@/lib/invoices/generate-pdf";

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const parsed = parseDraftPreviewInvoice(body);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  try {
    const ctx = await buildInvoicePdfContext(session.user.id, parsed.invoice);
    const pdf = await generateInvoicePdf(ctx);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="invoice-preview.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("preview/pdf: draft preview render failed", error);
    return jsonError("Preview could not be generated.", 500);
  }
}
