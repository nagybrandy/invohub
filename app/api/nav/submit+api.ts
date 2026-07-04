// app/api/nav/submit+api.ts
// Submit outgoing invoice to NAV (session auth).
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
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

  const submission = await submitOutgoingInvoiceToNav(session.user.id, invoice);
  return jsonResponse({
    submission: {
      status: submission.status,
      transactionId: submission.transactionId,
      submissionId: submission.submissionId,
    },
  });
}
