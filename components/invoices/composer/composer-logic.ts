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
import { parseExchangeRateInput, requiresExchangeRate } from "@/lib/invoices/exchange-rate";
import type { InvoiceCurrency, InvoiceLineItem, InvoiceStatus } from "@/lib/invoices/types";

export type ComposerStepId = "partner" | "items" | "review";

export const COMPOSER_STEP_ORDER: ComposerStepId[] = ["partner", "items", "review"];

export type ComposerDesktopLayout = {
  /** Whether the sticky 400px ComposerSummary column renders on this step. */
  showSummaryColumn: boolean;
  /** The form column's max width, or undefined for "no cap" (composer-line-item-horizontal-scroll-1440). */
  formMaxWidth: number | undefined;
};

/**
 * composer-line-item-horizontal-scroll-1440: the items step gets the full
 * content width — no 400px summary column, no 720px form cap — so the
 * 860px line-item grid (grid-columns.ts) fits without scrolling inside its
 * own card at 1440px. Partner and Ellenőrzés keep the summary + cap exactly
 * as before (see docs/decisions/2026-09-18-composer-items-step-full-width-grid.md).
 */
export function composerDesktopLayout(step: ComposerStepId): ComposerDesktopLayout {
  if (step === "items") {
    return { showSummaryColumn: false, formMaxWidth: undefined };
  }
  return { showSummaryColumn: true, formMaxWidth: 720 };
}

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

/**
 * Áfa tv. 169. § e) requires the buyer's name AND address on a finalized
 * document — checked only when the save action actually finalizes (see
 * SaveAction below); a draft may stay incomplete. Focuses the zip field,
 * the first of the three address inputs in the "Ügyfél adatai" panel
 * (StepPartner.tsx).
 */
export function validateBuyerAddressStep(fields: {
  clientZip: string;
  clientCity: string;
  clientAddress: string;
}): StepValidationResult {
  if (fields.clientZip.trim() && fields.clientCity.trim() && fields.clientAddress.trim()) {
    return { valid: true };
  }
  return {
    valid: false,
    errorKey: "invoices.errors.buyerAddressRequired",
    focusField: "clientZip",
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

/**
 * A non-HUF invoice needs a manually entered, positive HUF exchange rate
 * before it can be saved (spec §2, AC12) — a HUF invoice never needs one,
 * blank or not. Accepts both "390,5" and "390.5" (parseExchangeRateInput).
 */
export function validateExchangeRateInput(
  raw: string,
  currency: InvoiceCurrency
): StepValidationResult {
  if (!requiresExchangeRate(currency)) return { valid: true };
  if (!raw.trim()) {
    return {
      valid: false,
      errorKey: "invoices.errors.exchangeRateRequired",
      focusField: "exchangeRate",
    };
  }
  if (parseExchangeRateInput(raw) === null) {
    return {
      valid: false,
      errorKey: "invoices.errors.exchangeRateInvalid",
      focusField: "exchangeRate",
    };
  }
  return { valid: true };
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
