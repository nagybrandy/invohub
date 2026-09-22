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
import { CompanyProfileIncompleteError, listInvoices } from "@/lib/invoices/service";
import { sendInvoiceNotificationEmail } from "@/lib/invoices/send-invoice-email";
import { autoSubmitToNavOnFinalize, toNavAutoSubmitResult, type NavAutoSubmitResult } from "@/lib/nav/auto-submit";
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

    // Owner decision (2026-09-22): creating never e-mails by default. Only
    // an explicit `sendEmail: true` sends — and, for a draft body, that send
    // finalizes it first (assigns the number, status -> "sent"; see
    // send-invoice-email.ts). A default create leaves a draft a draft.
    const shouldSendEmail = body.sendEmail === true;
    let emailResult: Awaited<ReturnType<typeof sendInvoiceNotificationEmail>> | null = null;
    if (shouldSendEmail) {
      emailResult = await sendInvoiceNotificationEmail(userId, invoice.id, {
        to: body.emailTo,
        cc: body.emailCc,
        markSent: true,
      });
    }

    // NAV runs after the email step because that step may be what
    // finalizes a draft. A document created (or just made) final is
    // submitted automatically when NAV is configured; `submitToNav: true`
    // still forces an explicit (guarded, idempotent) attempt otherwise.
    const finalInvoice = emailResult?.invoice ?? invoice;
    let nav: NavAutoSubmitResult | null = await autoSubmitToNavOnFinalize(userId, null, finalInvoice);
    if (!nav && body.submitToNav === true) {
      nav = toNavAutoSubmitResult(await submitOutgoingInvoiceToNav(userId, finalInvoice));
    }

    return {
      status: 201,
      body: {
        invoice: finalInvoice,
        navSubmission: nav?.submission ?? null,
        nav,
        email: emailResult
          ? {
              sent: emailResult.ok,
              to: emailResult.to,
              cc: emailResult.cc,
              error: emailResult.error,
              // Stable machine-readable failure reason for API consumers —
              // see lib/invoices/send-error-i18n.ts for the matching copy.
              code: emailResult.code,
              pdfAttached: emailResult.pdfAttached,
            }
          : { sent: false, skipped: true },
      },
    };
  } catch (e) {
    if (e instanceof BuyerAddressMissingError) {
      return { status: 422, body: { error: e.message, code: e.code } };
    }
    if (e instanceof CompanyProfileIncompleteError) {
      return {
        status: 422,
        body: {
          error: "Company profile is incomplete.",
          code: "companyProfileIncomplete",
          missingFields: e.missingFields,
        },
      };
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
