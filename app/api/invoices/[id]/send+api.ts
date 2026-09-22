// app/api/invoices/[id]/send+api.ts
// Send invoice notification email with PDF attachment.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { sendInvoiceNotificationEmail } from "@/lib/invoices/send-invoice-email";

type Params = { id: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const id = await resolveIdParam(request, params);
  const body = (await request.json()) as {
    to?: string | string[];
    cc?: string | string[];
    templateType?: string;
  };

  const result = await sendInvoiceNotificationEmail(session.user.id, id, {
    to: body.to,
    cc: body.cc,
    templateType: body.templateType,
  });

  if (!result.ok) {
    if (result.code === "companyProfileIncomplete" || result.code === "buyerAddressMissing") {
      return jsonResponse(
        { error: result.error, code: result.code, missingFields: result.missingFields },
        422
      );
    }
    if (result.code === "invoiceFinalized") {
      return jsonResponse({ error: result.error, code: result.code }, 409);
    }
    return jsonResponse({ error: result.error, to: result.to }, result.error?.includes("not found") ? 404 : result.code === "noRecipient" ? 422 : 500);
  }

  return jsonResponse({
    ok: true,
    invoice: result.invoice,
    to: result.to,
    cc: result.cc,
    pdfAttached: result.pdfAttached,
  });
}
