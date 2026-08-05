// app/api/v1/invoices+api.ts
// External API: create invoice with API key auth; optional NAV forward and email send.
import {
  jsonApiResponse,
  requireApiKey,
} from "@/lib/api/api-key-auth";
import {
  createInvoiceFromPayload,
  type ExternalInvoiceInput,
} from "@/lib/invoices/create-from-payload";
import { sendInvoiceNotificationEmail } from "@/lib/invoices/send-invoice-email";
import { submitOutgoingInvoiceToNav } from "@/lib/nav/submit-outgoing";

export async function POST(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.response;

  let body: Partial<ExternalInvoiceInput>;
  try {
    body = (await request.json()) as Partial<ExternalInvoiceInput>;
  } catch {
    return jsonApiResponse({ error: "Invalid JSON body." }, 400);
  }

  try {
    const invoice = await createInvoiceFromPayload(auth.userId, body as ExternalInvoiceInput);

    let navSubmission: Awaited<ReturnType<typeof submitOutgoingInvoiceToNav>> | null = null;
    if (body.submitToNav === true) {
      navSubmission = await submitOutgoingInvoiceToNav(auth.userId, invoice);
    }

    const shouldSendEmail = body.sendEmail !== false;
    let emailResult: Awaited<ReturnType<typeof sendInvoiceNotificationEmail>> | null = null;
    if (shouldSendEmail) {
      emailResult = await sendInvoiceNotificationEmail(auth.userId, invoice.id, {
        to: body.emailTo,
        cc: body.emailCc,
        markSent: true,
      });
    }

    return jsonApiResponse(
      {
        invoice: emailResult?.invoice ?? invoice,
        navSubmission: navSubmission
          ? {
              submissionId: navSubmission.submissionId,
              status: navSubmission.status,
              transactionId: navSubmission.transactionId,
            }
          : null,
        email: emailResult
          ? {
              sent: emailResult.ok,
              to: emailResult.to,
              cc: emailResult.cc,
              error: emailResult.error,
              pdfAttached: emailResult.pdfAttached,
            }
          : { sent: false, skipped: true },
      },
      201
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create invoice.";
    return jsonApiResponse({ error: message }, 400);
  }
}
