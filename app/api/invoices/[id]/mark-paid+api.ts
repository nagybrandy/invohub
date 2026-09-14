// app/api/invoices/[id]/mark-paid+api.ts
// "Fizetettnek jelölés" — records a payment and derives paid/partially_paid/unpaid/overdue.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { resolveIdParam } from "@/lib/api/resolve-id-param";
import { markInvoicePaid } from "@/lib/invoices/service";
import type { PaymentMethod } from "@/lib/invoices/types";

type Params = { id: string };

const PAYMENT_METHODS: PaymentMethod[] = ["transfer", "cash", "card", "other"];

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

  if (body.paymentMethod !== undefined && !PAYMENT_METHODS.includes(body.paymentMethod as PaymentMethod)) {
    return jsonResponse(
      { error: `paymentMethod must be one of ${PAYMENT_METHODS.join(", ")}.` },
      400
    );
  }
  if (body.paidAmount !== undefined && (typeof body.paidAmount !== "number" || body.paidAmount < 0)) {
    return jsonResponse({ error: "paidAmount must be a non-negative number." }, 400);
  }

  const updated = await markInvoicePaid(session.user.id, id, {
    paymentMethod: body.paymentMethod as PaymentMethod | undefined,
    paidAt: body.paidAt,
    paidAmount: body.paidAmount,
  });

  if (!updated) {
    return jsonResponse({ error: "Not found" }, 404);
  }
  return jsonResponse({ invoice: updated });
}
