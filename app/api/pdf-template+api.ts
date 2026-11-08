// app/api/pdf-template+api.ts
// GET / PATCH user invoice PDF appearance settings; POST renders the sample
// invoice with an unsaved template (live preview and "Minta PDF letöltése").
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { buildSamplePdfContext } from "@/lib/invoices/build-pdf-context";
import { generateInvoicePdf } from "@/lib/invoices/generate-pdf";
import { applyPdfTemplateInput } from "@/lib/invoices/pdf-template/defaults";
import {
  getPdfTemplate,
  upsertPdfTemplate,
} from "@/lib/invoices/pdf-template/service";
import type { InvoicePdfTemplate } from "@/lib/invoices/pdf-template/types";
import { validatePdfTemplateInput } from "@/lib/invoices/pdf-template/validate";

function invalidTemplateResponse(fields: string[]) {
  return jsonResponse({ error: "Invalid PDF template.", code: "invalidPdfTemplate", fields }, 400);
}

async function readValidatedBody(request: Request, stored: InvoicePdfTemplate) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validatePdfTemplateInput(undefined);
  }
  return validatePdfTemplateInput(body, stored);
}

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const template = await getPdfTemplate(session.user.id);
  return Response.json({ template });
}

export async function PATCH(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const stored = await getPdfTemplate(session.user.id);
  const input = await readValidatedBody(request, stored);
  if (!input.ok) return invalidTemplateResponse(input.fields);

  const template = await upsertPdfTemplate(session.user.id, input.value);
  return Response.json({ template });
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  // An omitted field means "as saved", exactly as in PATCH, so the preview
  // matches what the user's new documents look like (a legacy row reads as
  // Letisztult, see resolveLiveTemplate).
  const stored = await getPdfTemplate(session.user.id);
  const input = await readValidatedBody(request, stored);
  if (!input.ok) return invalidTemplateResponse(input.fields);

  const template = applyPdfTemplateInput(stored, input.value);
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
