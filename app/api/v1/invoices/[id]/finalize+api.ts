// app/api/v1/invoices/[id]/finalize+api.ts
// External API: turn a draft into an issued invoice — assigns the number
// the exact same way the app already does (lib/invoices/service.ts's
// upsertInvoice -> assignInvoiceNumberIfNeeded; see finalizeInvoice, which
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
      });
      if (exchangeRate !== undefined) {
        invoice = await upsertInvoice(auth.userId, { ...invoice, exchangeRate });
      }
    }

    return { status: 200, body: { invoice } };
  });
}
