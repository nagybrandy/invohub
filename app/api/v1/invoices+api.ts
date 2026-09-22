// app/api/v1/invoices+api.ts
// External API: list invoices, and create an invoice with API key auth
// (optional NAV forward + email send). Scoped to the key's userId.
import {
  jsonApiResponse,
  requireApiKeyForV1,
} from "@/lib/api/api-key-auth";
import { withIdempotency } from "@/lib/api/idempotency";
import {
  createInvoiceFromPayload,
  type ExternalInvoiceInput,
} from "@/lib/invoices/create-from-payload";
import { BuyerAddressMissingError } from "@/lib/invoices/errors";
import { INVOICE_LIST_LIMIT, INVOICE_LIST_MAX_LIMIT } from "@/lib/invoices/constants";
import { normalizeInvoiceListFilters } from "@/lib/invoices/list-query";
import { listInvoices } from "@/lib/invoices/service";
import { sendInvoiceNotificationEmail } from "@/lib/invoices/send-invoice-email";
import { submitOutgoingInvoiceToNav } from "@/lib/nav/submit-outgoing";

function parseLimit(url: URL): number {
  const raw = url.searchParams.get("limit");
  if (!raw) return INVOICE_LIST_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return INVOICE_LIST_LIMIT;
  return Math.min(Math.max(1, parsed), INVOICE_LIST_MAX_LIMIT);
}

function parseOffset(url: URL): number {
  const raw = url.searchParams.get("offset");
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
}

export async function GET(request: Request) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const limit = parseLimit(url);
  const offset = parseOffset(url);
  const filters = normalizeInvoiceListFilters({
    status: url.searchParams.get("status"),
    search: url.searchParams.get("search"),
    needsExchangeRate: url.searchParams.get("needsExchangeRate"),
  });

  const result = await listInvoices(auth.userId, { limit, offset, ...filters });
  return jsonApiResponse(result);
}

async function createInvoiceAndSideEffects(
  userId: string,
  body: Partial<ExternalInvoiceInput>
): Promise<{ status: number; body: unknown }> {
  try {
    const invoice = await createInvoiceFromPayload(userId, body as ExternalInvoiceInput);

    let navSubmission: Awaited<ReturnType<typeof submitOutgoingInvoiceToNav>> | null = null;
    if (body.submitToNav === true) {
      navSubmission = await submitOutgoingInvoiceToNav(userId, invoice);
    }

    // NOTE(sendEmail default): sendEmail defaults to true even for a
    // status: "draft" body — a draft has no invoiceNumber yet, so
    // sendInvoiceNotificationEmail finalizes it (assigns a number, flips
    // status to "sent") before emailing. That is existing behaviour
    // (create-from-payload.ts / send-invoice-email.ts), not something this
    // slice changed — flagged in the PR description, not fixed here.
    const shouldSendEmail = body.sendEmail !== false;
    let emailResult: Awaited<ReturnType<typeof sendInvoiceNotificationEmail>> | null = null;
    if (shouldSendEmail) {
      emailResult = await sendInvoiceNotificationEmail(userId, invoice.id, {
        to: body.emailTo,
        cc: body.emailCc,
        markSent: true,
      });
    }

    return {
      status: 201,
      body: {
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
    };
  } catch (e) {
    if (e instanceof BuyerAddressMissingError) {
      return { status: 422, body: { error: e.message, code: e.code } };
    }
    const message = e instanceof Error ? e.message : "Failed to create invoice.";
    return { status: 400, body: { error: message } };
  }
}

export async function POST(request: Request) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  let body: Partial<ExternalInvoiceInput>;
  try {
    body = (await request.json()) as Partial<ExternalInvoiceInput>;
  } catch {
    return jsonApiResponse({ error: "Invalid JSON body." }, 400);
  }

  return withIdempotency(request, auth.userId, body, () =>
    createInvoiceAndSideEffects(auth.userId, body)
  );
}
