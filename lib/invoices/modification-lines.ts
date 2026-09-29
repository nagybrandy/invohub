// lib/invoices/modification-lines.ts
// Starting lines of a helyesbítő (modify / correction) draft. Pure — no DB.
//
// Owner decision (2026-09-22): NAV treats the lines of a MODIFY document as
// DIFFERENCES against the original (lineOperation CREATE, see
// lib/nav/invoice-xml.ts), so a correction draft must start from a zero
// difference, not from a copy of the original. For every original line the
// draft gets, in order:
//   (a) a reversing line — same description/unit/unit price/VAT, quantity
//       negated — which cancels the original line, and
//   (b) an editable copy of the original line.
// The draft therefore nets to zero; the user rewrites the copies to the
// corrected values (or deletes pairs that did not change), and what is left
// is exactly the difference NAV expects.
import { createId } from "@/lib/id";
import type { InvoiceLineItem } from "@/lib/invoices/types";

/** The reversing counterpart of one original line (quantity negated, everything else equal). */
export function buildReversingLine(item: InvoiceLineItem): InvoiceLineItem {
  // `0 - q` rather than `-q` so a zero quantity stays +0 (never prints "-0").
  return { ...item, id: createId(), quantity: 0 - item.quantity };
}

/** [reversal, copy] per original line, in the original's order. */
export function buildModificationDraftLineItems(source: InvoiceLineItem[]): InvoiceLineItem[] {
  return source.flatMap((item) => [
    buildReversingLine(item),
    { ...item, id: createId() },
  ]);
}
