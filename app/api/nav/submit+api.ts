// app/api/nav/submit+api.ts
// Submit (or retry) an outgoing invoice to NAV (session auth) — backs the
// "Beküldés" / "Újrapróbálás" button on the invoice detail screen.
//
// Guarded + idempotent (lib/nav/submission-guard.ts, lib/nav/submit-outgoing.ts):
//  - 409 draftNotSubmittable / 422 proformaNotSubmittable /
//    409 missingExchangeRate — refused before any NAV call;
//  - an in-progress or DONE submission is returned as-is (200,
//    alreadySubmitted: true) instead of reporting the invoice twice;
//  - a NAV failure is recorded and answered with 502 navSubmitFailed.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { getInvoiceById } from "@/lib/invoices/service";
import { checkNavSubmittable } from "@/lib/nav/submission-guard";
import { serializeNavSubmission } from "@/lib/nav/serialize-submission";
import { submitOutgoingInvoiceToNav } from "@/lib/nav/submit-outgoing";

const REJECTION_MESSAGES: Record<string, string> = {
  draftNotSubmittable: "A draft cannot be submitted to NAV — finalize the invoice first.",
  proformaNotSubmittable: "A proforma is not an invoice, so it cannot be submitted to NAV.",
  missingExchangeRate: "NAV submission is not possible: the invoice has no HUF exchange rate.",
};

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as { invoiceId?: string };
  if (!body.invoiceId) {
    return jsonResponse({ error: "invoiceId required." }, 400);
  }

  const invoice = await getInvoiceById(session.user.id, body.invoiceId);
  if (!invoice) return jsonResponse({ error: "Invoice not found." }, 404);

  const check = checkNavSubmittable(invoice);
  if (!check.ok) {
    return jsonResponse({ error: REJECTION_MESSAGES[check.code], code: check.code }, check.httpStatus);
  }

  const outcome = await submitOutgoingInvoiceToNav(session.user.id, invoice);
  switch (outcome.kind) {
    case "rejected":
      return jsonResponse({ error: REJECTION_MESSAGES[outcome.code], code: outcome.code }, outcome.httpStatus);
    case "existing":
      return jsonResponse({ submission: serializeNavSubmission(outcome.submission), alreadySubmitted: true });
    case "failed":
      return jsonResponse(
        { error: outcome.error, code: "navSubmitFailed", submission: serializeNavSubmission(outcome.submission) },
        502
      );
    default:
      return jsonResponse({ submission: serializeNavSubmission(outcome.submission) });
  }
}
