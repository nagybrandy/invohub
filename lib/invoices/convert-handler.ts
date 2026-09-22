// lib/invoices/convert-handler.ts
// Shared guard + race-handling for "Számla készítése ebből" (díjbekérő ->
// számla) — used by both the internal session route
// (app/api/invoices/[id]/convert+api.ts) and the external v1 route, so the
// canConvertProforma guard and the double-conversion race handling
// (isUniqueViolation) never drift between the two.
import { isUniqueViolation } from "@/lib/db/unique-violation";
import { canConvertProforma } from "@/lib/invoices/convert-proforma";
import {
  convertProformaToInvoice,
  findExistingConversion,
  getInvoiceById,
} from "@/lib/invoices/service";
import type { Invoice } from "@/lib/invoices/types";

const CONVERTED_FROM_LIVE_UNIQUE_INDEX = "invoice_converted_from_live_unique_idx";

export type PerformConvertResult =
  | { ok: true; invoice: Invoice }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "notProforma" | "cancelled" }
  | { ok: false; reason: "already_converted"; invoice: Invoice };

export async function performConvert(userId: string, id: string): Promise<PerformConvertResult> {
  const existing = await getInvoiceById(userId, id);
  if (!existing) return { ok: false, reason: "not_found" };

  const canConvert = canConvertProforma(existing);
  if (!canConvert.ok) return { ok: false, reason: canConvert.reason };

  const existingConversion = await findExistingConversion(userId, existing.id);
  if (existingConversion) {
    return { ok: false, reason: "already_converted", invoice: existingConversion };
  }

  try {
    const invoice = await convertProformaToInvoice(userId, existing);
    return { ok: true, invoice };
  } catch (e) {
    // The pre-check above is check-then-act and can race (two concurrent
    // requests, or two open tabs) — invoice_converted_from_live_unique_idx
    // is the DB-level backstop. When it fires, whoever won the race is
    // already committed, so re-run the same lookup and return the winner.
    if (isUniqueViolation(e, CONVERTED_FROM_LIVE_UNIQUE_INDEX)) {
      const winner = await findExistingConversion(userId, existing.id);
      if (winner) {
        return { ok: false, reason: "already_converted", invoice: winner };
      }
      // The violation fired but the winner is no longer live (e.g. it was
      // cancelled between the insert and this re-lookup) — don't fabricate
      // an already_converted result with a null invoice; surface the
      // original error instead.
    }
    throw e;
  }
}
