// app/api/v1/invoices/[id]/convert+api.ts
// External API: "Számla készítése ebből" (díjbekérő -> számla) — same guard
// and double-conversion race handling as the internal route via
// lib/invoices/convert-handler.ts. Idempotency-Key guarded on top of the
// existing already_converted 409 (both can fire independently: a repeated
// Idempotency-Key replays the first response; two different requests
// converting the same proforma get the 409 either way).
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { withIdempotency } from "@/lib/api/idempotency";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { performConvert } from "@/lib/invoices/convert-handler";

type Params = { id: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const id = await resolveIdParam(request, params);

  return withIdempotency(request, auth.userId, { id }, async () => {
    const result = await performConvert(auth.userId, id);

    if (!result.ok) {
      if (result.reason === "not_found") {
        return { status: 404, body: { error: "Invoice not found." } };
      }
      if (result.reason === "already_converted") {
        return {
          status: 409,
          body: { error: "This proforma was already converted.", code: "alreadyConverted", invoice: result.invoice },
        };
      }
      return { status: 400, body: { error: `Cannot convert: ${result.reason}.`, code: result.reason } };
    }

    return { status: 201, body: { invoice: result.invoice } };
  });
}
