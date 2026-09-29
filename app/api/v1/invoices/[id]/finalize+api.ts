// app/api/v1/invoices/[id]/finalize+api.ts
// External API: turn a draft into an issued invoice — assigns the number
// the exact same way the app already does (lib/invoices/service.ts's
// upsertInvoice's atomic numbering transaction; see finalizeInvoice, which
// mirrors the composer's "Véglegesítés" action). Supports Idempotency-Key
// so a retried request never allocates a second number.
import {
  jsonApiResponse,
  requireApiKeyForV1,
} from "@/lib/api/api-key-auth";
import { withIdempotency } from "@/lib/api/idempotency";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { requiresExchangeRate } from "@/lib/invoices/exchange-rate";
import { autofillMissingExchangeRate } from "@/lib/invoices/exchange-rate-autofill";
import { finalizeInvoice, upsertInvoice } from "@/lib/invoices/service";
import type { Invoice } from "@/lib/invoices/types";
import { autoSubmitToNavOnFinalize } from "@/lib/nav/auto-submit";

type Params = { id: string };

/** True when the stored value isn't a usable positive, finite rate. */
function needsExchangeRate(currency: Invoice["currency"], rate: number | undefined): boolean {
  return (
    requiresExchangeRate(currency) &&
    !(typeof rate === "number" && Number.isFinite(rate) && rate > 0)
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const id = await resolveIdParam(request, params);

  return withIdempotency(request, auth.userId, { id }, async () => {
    const result = await finalizeInvoice(auth.userId, id);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return { status: 404, body: { error: "Invoice not found." } };
      }
      if (result.reason === "buyer_address_missing") {
        return {
          status: 422,
          body: {
            error:
              "Buyer name and address (clientZipCode, clientCity, clientAddress) are required to finalize an invoice.",
            code: "buyerAddressMissing",
          },
        };
      }
      if (result.reason === "company_profile_incomplete") {
        return {
          status: 422,
          body: {
            error: "Company profile is incomplete.",
            code: "companyProfileIncomplete",
            missingFields: result.missingFields,
          },
        };
      }
      return {
        status: 409,
        body: { error: "Only a draft invoice can be finalized.", code: "notDraft" },
      };
    }

    let invoice = result.invoice;
    // Server safety net (item 6): a draft that reached finalize with no
    // rate (e.g. created before this feature, or MNB was down at create
    // time) still gets one now instead of shipping finalized-but-empty.
    if (needsExchangeRate(invoice.currency, invoice.exchangeRate)) {
      const exchangeRate = await autofillMissingExchangeRate({
        currency: invoice.currency,
        exchangeRate: invoice.exchangeRate,
        issueDate: invoice.issueDate,
        // Áfa tv. 80. §: the teljesítés date's rate when known.
        fulfillmentDate: invoice.fulfillmentDate,
      });
      if (exchangeRate !== undefined) {
        invoice = await upsertInvoice(auth.userId, { ...invoice, exchangeRate });
      }
    }

    // finalizeInvoice only ever finalizes a draft, so this is always a
    // finalization: report it to NAV when configured (never throws). Runs
    // after the rate safety net so the XML carries the filled-in rate.
    const nav = await autoSubmitToNavOnFinalize(auth.userId, null, invoice);
    return { status: 200, body: { invoice, nav } };
  });
}
