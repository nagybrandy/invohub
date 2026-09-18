// app/api/nav/submit+api.ts
// Submit outgoing invoice to NAV (session auth).
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
// Imported from lib/invoices/ (not lib/nav/) — this route's refusal stays a
// pure read of the same predicate the NAV XML builder enforces, so the two
// can never drift apart. See plan docs/plans/2026-09-18-backfill-non-huf-
// invoices-missing-exchange-rate.md.
import { isMissingExchangeRate } from "@/lib/invoices/exchange-rate";
import { getInvoiceById } from "@/lib/invoices/service";
import { submitOutgoingInvoiceToNav } from "@/lib/nav/submit-outgoing";

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as { invoiceId?: string };
  if (!body.invoiceId) {
    return jsonResponse({ error: "invoiceId required." }, 400);
  }

  const invoice = await getInvoiceById(session.user.id, body.invoiceId);
  if (!invoice) return jsonResponse({ error: "Invoice not found." }, 404);

  if (isMissingExchangeRate(invoice)) {
    return jsonResponse(
      {
        error: "NAV submission is not possible: the invoice has no HUF exchange rate.",
        code: "missingExchangeRate",
      },
      409
    );
  }

  const submission = await submitOutgoingInvoiceToNav(session.user.id, invoice);
  return jsonResponse({
    submission: {
      status: submission.status,
      transactionId: submission.transactionId,
      submissionId: submission.submissionId,
    },
  });
}
