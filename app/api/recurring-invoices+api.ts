// app/api/recurring-invoices+api.ts
// List the active billing account's recurring invoice templates / save an
// invoice (issued or draft) as one. v1 only ever generates DRAFTS — see
// lib/recurring/service.ts.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { parseCreateBody } from "@/lib/recurring/input";
import { RecurringTemplateError, createTemplateFromInvoiceId, listTemplates } from "@/lib/recurring/service";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();
  return jsonResponse({ templates: await listTemplates(session.user.id) });
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const input = parseCreateBody(await request.json().catch(() => null));
  if (!input) {
    return jsonResponse({ error: "sourceInvoiceId, frequency and startDate are required.", code: "invalidInput" }, 400);
  }

  try {
    const template = await createTemplateFromInvoiceId(session.user.id, input.sourceInvoiceId, input.schedule, {
      name: input.name,
    });
    if (!template) return jsonResponse({ error: "Invoice not found" }, 404);
    return jsonResponse({ template }, 201);
  } catch (error) {
    if (error instanceof RecurringTemplateError) {
      return jsonResponse({ error: error.message, code: error.code }, 422);
    }
    throw error;
  }
}
