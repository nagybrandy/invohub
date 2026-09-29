// lib/invoices/mark-paid-input.ts
// Shared body validation for "mark paid" — used by both the internal
// session route (app/api/invoices/[id]/mark-paid+api.ts) and the external
// v1 route, so the two never validate this input differently.
import type { MarkInvoicePaidInput } from "@/lib/invoices/service";
import type { PaymentMethod } from "@/lib/invoices/types";

const PAYMENT_METHODS: PaymentMethod[] = ["transfer", "cash", "card", "other"];

export type ParseMarkPaidInputResult =
  | { ok: true; input: MarkInvoicePaidInput }
  | { ok: false; error: string };

export function parseMarkPaidInput(body: {
  paymentMethod?: unknown;
  paidAt?: unknown;
  paidAmount?: unknown;
}): ParseMarkPaidInputResult {
  if (
    body.paymentMethod !== undefined &&
    !PAYMENT_METHODS.includes(body.paymentMethod as PaymentMethod)
  ) {
    return {
      ok: false,
      error: `paymentMethod must be one of ${PAYMENT_METHODS.join(", ")}.`,
    };
  }
  if (
    body.paidAmount !== undefined &&
    (typeof body.paidAmount !== "number" || body.paidAmount < 0)
  ) {
    return { ok: false, error: "paidAmount must be a non-negative number." };
  }

  return {
    ok: true,
    input: {
      paymentMethod: body.paymentMethod as PaymentMethod | undefined,
      paidAt: body.paidAt as string | undefined,
      paidAmount: body.paidAmount as number | undefined,
    },
  };
}
