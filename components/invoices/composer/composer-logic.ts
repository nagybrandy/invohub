// components/invoices/composer/composer-logic.ts
// Pure helpers for the invoice composer: save-action → status mapping and
// step validation. Kept dependency-free so they're trivial to unit test
// without rendering anything (INV-1, INV-2, INV-4, INV-8, INV-15).
import type { DocumentType } from "@/components/invoices/DocumentTypeTabs";
import {
  lineItemNetTotal,
  lineItemVatAmount,
} from "@/lib/invoices/calculations";
import { lineItemEffectiveVatRate } from "@/lib/invoices/calculations";
import type { InvoiceLineItem, InvoiceStatus } from "@/lib/invoices/types";

export type ComposerStepId = "partner" | "items" | "review";

export const COMPOSER_STEP_ORDER: ComposerStepId[] = ["partner", "items", "review"];

/** INV-6: suggested units of measure for the line-item grid's "Egység" column. */
export const UNIT_OPTIONS = ["db", "óra", "nap", "hó", "km", "kg", "m²", "alkalom"];

/** The three ways a composer save can be triggered (spec §2.5). */
export type SaveAction = "draft" | "finalize" | "finalizeAndSend";

/**
 * INV-15: `sent` is only ever persisted when the user explicitly chose
 * "Véglegesítés és küldés" — "Véglegesítés" alone saves `unpaid` and sends
 * nothing. A proforma document type always saves as `proforma` regardless
 * of which button was pressed, matching the pre-composer behaviour.
 */
export function resolveStatusForAction(
  action: SaveAction,
  documentType: DocumentType
): InvoiceStatus {
  if (documentType === "proforma") return "proforma";
  if (action === "draft") return "draft";
  if (action === "finalize") return "unpaid";
  return "sent";
}

/** Only "Véglegesítés és küldés" ever triggers the send-email API call. */
export function shouldSendOnAction(action: SaveAction): boolean {
  return action === "finalizeAndSend";
}

export type StepValidationResult = {
  valid: boolean;
  /** i18n key for the first blocking error, if any. */
  errorKey?: string;
  /** Field to focus when this step's error is surfaced. */
  focusField?: string;
};

/** INV-4: partner name is the only required field in step 1. */
export function validatePartnerStep(clientName: string): StepValidationResult {
  if (clientName.trim()) return { valid: true };
  return {
    valid: false,
    errorKey: "invoices.errors.clientRequired",
    focusField: "clientName",
  };
}

/** INV-4: at least one line item needs a description before it counts. */
export function validateLineItemsStep(lineItems: InvoiceLineItem[]): StepValidationResult {
  if (lineItems.some((item) => item.description.trim())) return { valid: true };
  return {
    valid: false,
    errorKey: "invoices.errors.lineItemRequired",
    focusField: "lineItem-0-description",
  };
}

/** INV-8: the due date may never sit before the issue date. */
export function validateDueDate(issueDate: string, dueDate: string): StepValidationResult {
  if (!issueDate || !dueDate || dueDate >= issueDate) return { valid: true };
  return {
    valid: false,
    errorKey: "invoices.errors.dueBeforeIssue",
    focusField: "dueDate",
  };
}

/** Step 3 requires a client e-mail before the "send" toggle can be turned on. */
export function canEnableEmailOnSend(clientEmail: string): boolean {
  return clientEmail.trim().length > 0;
}

export type VatBreakdownRow = {
  /** "normal-27" for a taxed rate, or the VatCategory code for an exempt one. */
  key: string;
  /** e.g. "27%" or "AAM". */
  label: string;
  net: number;
  vat: number;
};

/**
 * Groups line items into the VAT rows shown under the line-item grid
 * (spec §2.4: "ÁFA (27%)" / "ÁFA (AAM 0%)" per rate/category) and in the
 * sticky summary. Always returns at least an empty array — the caller
 * decides what "no rows yet" looks like.
 */
export function groupVatRows(lineItems: InvoiceLineItem[]): VatBreakdownRow[] {
  const rows = new Map<string, VatBreakdownRow>();
  for (const item of lineItems) {
    if (!item.description.trim()) continue;
    const isNormal = item.vatCategory === "normal";
    const rate = lineItemEffectiveVatRate(item);
    const key = isNormal ? `normal-${rate}` : item.vatCategory;
    const label = isNormal ? `${rate}%` : item.vatCategory;
    const existing = rows.get(key);
    const net = lineItemNetTotal(item);
    const vat = lineItemVatAmount(item);
    if (existing) {
      existing.net += net;
      existing.vat += vat;
    } else {
      rows.set(key, { key, label, net, vat });
    }
  }
  return Array.from(rows.values());
}
