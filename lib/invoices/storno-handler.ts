// lib/invoices/storno-handler.ts
// Shared guard + orchestration for "storno" (cancellation) — used by both
// the internal session route (app/api/invoices/[id]/storno+api.ts) and the
// external v1 route, so the proforma/already-cancelled guards never drift
// between the two.
import { createStornoInvoice, getInvoiceById } from "@/lib/invoices/service";
import type { Invoice } from "@/lib/invoices/types";

export type PerformStornoResult =
  | { ok: true; invoice: Invoice }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "proforma" }
  | { ok: false; reason: "already_cancelled" };

export async function performStorno(userId: string, id: string): Promise<PerformStornoResult> {
  const existing = await getInvoiceById(userId, id);
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.documentType === "proforma") return { ok: false, reason: "proforma" };
  if (existing.status === "cancelled") return { ok: false, reason: "already_cancelled" };

  const invoice = await createStornoInvoice(userId, existing);
  return { ok: true, invoice };
}
