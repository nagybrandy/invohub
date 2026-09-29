// app/api/invoices/[id]/mark-paid+api.ts
// "Fizetettnek jelölés" — records a payment and derives paid/partially_paid/unpaid/overdue.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { parseMarkPaidInput } from "@/lib/invoices/mark-paid-input";
import { markInvoicePaid } from "@/lib/invoices/service";

type Params = { id: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const id = await resolveIdParam(request, params);
  const body = (await request.json().catch(() => ({}))) as {
    paymentMethod?: string;
    paidAt?: string;
    paidAmount?: number;
  };

  const parsed = parseMarkPaidInput(body);
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error }, 400);
  }

  const updated = await markInvoicePaid(session.user.id, id, parsed.input);

  if (!updated) {
    return jsonResponse({ error: "Not found" }, 404);
  }
  return jsonResponse({ invoice: updated });
}
