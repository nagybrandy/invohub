// app/api/invoices/[id]/send+api.ts
// Send invoice notification email with PDF attachment.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { sendInvoiceNotificationEmail } from "@/lib/invoices/send-invoice-email";
import { statusForSendFailure } from "@/lib/invoices/send-error-status";

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
    // `error` stays in English for server-side logs / API consumers —
    // `code` is what the UI must translate and show (see
    // lib/invoices/send-error-i18n.ts); never render `error` directly.
    return jsonResponse(
      { error: result.error, code: result.code, missingFields: result.missingFields, to: result.to },
      statusForSendFailure(result)
    );
  }

  return jsonResponse({
    ok: true,
    invoice: result.invoice,
    to: result.to,
    cc: result.cc,
    pdfAttached: result.pdfAttached,
  });
}
