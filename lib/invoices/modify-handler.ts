// lib/invoices/modify-handler.ts
// Shared guard + orchestration for starting a helyesbítő (correction) draft
// — used by both the internal session route
// (app/api/invoices/[id]/modify+api.ts) and the external v1 route, so the
// proforma guard never drifts between the two.
import { createModificationDraft, getInvoiceById } from "@/lib/invoices/service";
import type { Invoice } from "@/lib/invoices/types";

export type PerformModifyResult =
  | { ok: true; invoice: Invoice }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "proforma" };

export async function performModify(userId: string, id: string): Promise<PerformModifyResult> {
  const existing = await getInvoiceById(userId, id);
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.documentType === "proforma") return { ok: false, reason: "proforma" };

  const invoice = await createModificationDraft(userId, existing);
  return { ok: true, invoice };
}
