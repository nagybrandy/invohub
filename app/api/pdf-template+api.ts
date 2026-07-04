// app/api/pdf-template+api.ts
// GET / PATCH user invoice PDF appearance settings.
import { requireSession, unauthorizedResponse } from "@/lib/api/session";
import { mergePdfTemplate } from "@/lib/invoices/pdf-template/defaults";
import {
  getPdfTemplate,
  upsertPdfTemplate,
} from "@/lib/invoices/pdf-template/service";
import type { InvoicePdfTemplateInput } from "@/lib/invoices/pdf-template/types";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const template = await getPdfTemplate(session.user.id);
  return Response.json({ template });
}

export async function PATCH(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as InvoicePdfTemplateInput;
  const template = await upsertPdfTemplate(session.user.id, body);
  return Response.json({ template });
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as InvoicePdfTemplateInput;
  const template = mergePdfTemplate(body);
  const { buildSamplePdfContext } = await import("@/lib/invoices/build-pdf-context");
  const { generateInvoicePdf } = await import("@/lib/invoices/generate-pdf");

  const ctx = await buildSamplePdfContext(session.user.id);
  const pdf = await generateInvoicePdf({ ...ctx, template });

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="invoice-sample.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
