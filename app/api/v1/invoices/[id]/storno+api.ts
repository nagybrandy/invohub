// app/api/v1/invoices/[id]/storno+api.ts
// External API: create a storno (cancellation) document — same guard as the
// internal route via lib/invoices/storno-handler.ts. Idempotency-Key
// guarded so a retry never mints a second storno number.
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { withIdempotency } from "@/lib/api/idempotency";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { performStorno } from "@/lib/invoices/storno-handler";

type Params = { id: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const id = await resolveIdParam(request, params);

  return withIdempotency(request, auth.userId, { id }, async () => {
    const result = await performStorno(auth.userId, id);

    if (!result.ok) {
      if (result.reason === "not_found") {
        return { status: 404, body: { error: "Invoice not found." } };
      }
      if (result.reason === "proforma") {
        return {
          status: 400,
          body: { error: "A díjbekérő nem sztornózható.", code: "proformaNotStornoable" },
        };
      }
      return { status: 400, body: { error: "Invoice is already cancelled." } };
    }

    return { status: 201, body: { invoice: result.invoice, nav: result.nav } };
  });
}
