// lib/lists/invoice-menu.ts
// Which actions a list row's "..." menu offers for an invoice (SPEC §6.8):
// at most five, chosen from what the list already did, in a fixed order:
// open, PDF, duplicate (creates a draft), mark paid (only where the list
// allowed it), the díjbekérő conversion, delete (drafts only, red). Sending
// by e-mail, storno and anything NAV-related stay on the detail page.
import { canDeleteFromList } from "@/lib/invoices/list-actions";
import type { Invoice } from "@/lib/invoices/types";

export type InvoiceMenuAction =
  | "open"
  | "pdf"
  | "duplicate"
  | "markPaid"
  | "convert"
  | "openConverted"
  | "delete";

export const MAX_INVOICE_MENU_ACTIONS = 5;

export function canMarkPaidFromList(invoice: Pick<Invoice, "status">): boolean {
  return invoice.status !== "paid" && invoice.status !== "cancelled" && invoice.status !== "draft";
}

export function invoiceMenuActions(
  invoice: Pick<Invoice, "status" | "documentType">,
  options: { convertedExists?: boolean } = {},
): InvoiceMenuAction[] {
  const actions: InvoiceMenuAction[] = ["open", "pdf", "duplicate"];
  if (canMarkPaidFromList(invoice)) actions.push("markPaid");
  if (invoice.documentType === "proforma") {
    actions.push(options.convertedExists ? "openConverted" : "convert");
  }
  if (canDeleteFromList(invoice)) actions.push("delete");
  // Over the cap (cannot happen with today's rules, but the design is a hard
  // limit): drop the least important non-destructive entries first.
  const dropOrder: InvoiceMenuAction[] = ["markPaid", "pdf", "duplicate"];
  for (const drop of dropOrder) {
    if (actions.length <= MAX_INVOICE_MENU_ACTIONS) break;
    const index = actions.indexOf(drop);
    if (index >= 0) actions.splice(index, 1);
  }
  return actions;
}
