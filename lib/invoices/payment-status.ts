// lib/invoices/payment-status.ts
// Payment-derived status logic + graceful fallback for the legacy
// "payment method written into notes" era (before it was a real column).
import type { InvoiceStatus, PaymentMethod } from "@/lib/invoices/types";

/** Every InvoHub invoice payment method, in composer/pill display order. */
export const PAYMENT_METHODS: PaymentMethod[] = ["transfer", "cash", "card", "other"];

/** Type guard: true only for one of the four known PaymentMethod values. */
export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as string[]).includes(value);
}

const LEGACY_NOTES_METHOD_HU: Record<string, PaymentMethod> = {
  átutalás: "transfer",
  utalás: "transfer",
  készpénz: "cash",
  bankkártya: "card",
  kártya: "card",
};

/**
 * Older invoices had no paymentMethod column — the value lived inside notes
 * as a "Fizetés: <label>" line (see composeInvoiceNotes). Parse it out so
 * old invoices still show a payment method until they're resaved.
 */
export function parsePaymentMethodFromNotes(notes?: string | null): PaymentMethod | undefined {
  if (!notes) return undefined;
  const match = notes.match(/Fizet[eé]s:\s*([^\n]+)/i);
  const label = match?.[1]?.trim().toLowerCase();
  if (!label) return undefined;
  for (const [needle, method] of Object.entries(LEGACY_NOTES_METHOD_HU)) {
    if (label.includes(needle)) return method;
  }
  return undefined;
}

/** paymentMethod column wins; falls back to parsing the legacy notes text. */
export function resolvePaymentMethod(
  paymentMethod: PaymentMethod | null | undefined,
  notes?: string | null
): PaymentMethod | undefined {
  return paymentMethod ?? parsePaymentMethodFromNotes(notes);
}

const PAID_EPSILON = 0.01;

/** Status to persist after a "mark as paid" action, based on paid vs. total amount and due date. */
export function deriveInvoiceStatusFromPayment(
  totalAmount: number,
  paidAmount: number,
  dueDate: string,
  now: Date = new Date()
): InvoiceStatus {
  if (paidAmount <= 0) {
    const due = new Date(`${dueDate.slice(0, 10)}T23:59:59`);
    return now.getTime() > due.getTime() ? "overdue" : "unpaid";
  }
  if (paidAmount >= totalAmount - PAID_EPSILON) {
    return "paid";
  }
  return "partially_paid";
}
