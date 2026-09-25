// app/api/v1/invoices/[id]/modify+api.ts
// External API: start a helyesbítő (correction) draft — same guard as the
// internal route via lib/invoices/modify-handler.ts. Idempotency-Key
// guarded so a retry never creates two correction drafts.
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { withIdempotency } from "@/lib/api/idempotency";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { performModify } from "@/lib/invoices/modify-handler";

type Params = { id: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const id = await resolveIdParam(request, params);

  return withIdempotency(request, auth.userId, { id }, async () => {
    const result = await performModify(auth.userId, id);

    if (!result.ok) {
      if (result.reason === "not_found") {
        return { status: 404, body: { error: "Invoice not found." } };
      }
      return {
        status: 400,
        body: { error: "A proforma cannot be corrected (helyesbítő).", code: "proformaNotStornoable" },
      };
    }

    return { status: 201, body: { invoice: result.invoice } };
  });
}
