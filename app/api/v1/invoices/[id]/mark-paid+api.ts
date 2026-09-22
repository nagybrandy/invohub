// app/api/v1/invoices/[id]/mark-paid+api.ts
// External API: "Fizetettnek jelölés" — same parseMarkPaidInput validation
// and markInvoicePaid as the internal session route. Not Idempotency-Key
// gated (see docs/external-api.md) — repeated calls intentionally
// accumulate further payments, same as the internal route.
import {
  jsonApiResponse,
  requireApiKeyForV1,
} from "@/lib/api/api-key-auth";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { parseMarkPaidInput } from "@/lib/invoices/mark-paid-input";
import { markInvoicePaid } from "@/lib/invoices/service";

type Params = { id: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const auth = await requireApiKeyForV1(request);
  if (!auth.ok) return auth.response;

  const id = await resolveIdParam(request, params);
  const body = (await request.json().catch(() => ({}))) as {
    paymentMethod?: string;
    paidAt?: string;
    paidAmount?: number;
  };

  const parsed = parseMarkPaidInput(body);
  if (!parsed.ok) {
    return jsonApiResponse({ error: parsed.error }, 400);
  }

  const updated = await markInvoicePaid(auth.userId, id, parsed.input);
  if (!updated) {
    return jsonApiResponse({ error: "Invoice not found." }, 404);
  }

  return jsonApiResponse({ invoice: updated });
}
