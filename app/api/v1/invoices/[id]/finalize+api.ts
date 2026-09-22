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
import { finalizeInvoice } from "@/lib/invoices/service";

type Params = { id: string };

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
      return {
        status: 409,
        body: { error: "Only a draft invoice can be finalized.", code: "notDraft" },
      };
    }
    return { status: 200, body: { invoice: result.invoice } };
  });
}
