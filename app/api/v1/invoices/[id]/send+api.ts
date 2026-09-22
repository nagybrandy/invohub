// app/api/v1/invoices/[id]/send+api.ts
// External API: send invoice notification email with PDF attachment — same
// lib/invoices/send-invoice-email.ts as the session-authenticated route.
// Supports Idempotency-Key so a retried request never sends the email twice.
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { withIdempotency } from "@/lib/api/idempotency";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { sendInvoiceNotificationEmail } from "@/lib/invoices/send-invoice-email";

type Params = { id: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const id = await resolveIdParam(request, params);

  let body: { to?: string | string[]; cc?: string | string[]; templateType?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  // `id` is folded into the hashed request body (not just the body) so the
  // same Idempotency-Key + an identical-looking body (e.g. both {}) never
  // replays across two different invoices.
  return withIdempotency(request, auth.userId, { id, ...body }, async () => {
    const result = await sendInvoiceNotificationEmail(auth.userId, id, {
      to: body.to,
      cc: body.cc,
      templateType: body.templateType,
    });

    if (!result.ok) {
      if (result.code === "companyProfileIncomplete" || result.code === "buyerAddressMissing") {
        return {
          status: 422,
          body: { error: result.error, code: result.code, missingFields: result.missingFields },
        };
      }
      const status = result.error?.toLowerCase().includes("not found") ? 404 : result.code === "noRecipient" ? 422 : 500;
      return { status, body: { error: result.error, to: result.to } };
    }

    return {
      status: 200,
      body: {
        invoice: result.invoice,
        to: result.to,
        cc: result.cc,
        pdfAttached: result.pdfAttached,
      },
    };
  });
}
