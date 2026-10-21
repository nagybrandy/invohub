// lib/companies/billing-settings.ts
// Pure validation for the per-company tax profile, invoicing defaults and the
// invoice-number prefix (settings → Számlázási beállítások). No DB import, so
// the API route, the service and the UI can all share it.
//
// These are SETTINGS the user states about their own business — they are
// stored and used as defaults, not interpreted as tax advice.
import type { PaymentMethod } from "@/lib/invoices/types";

export const TAX_MODES = ["kata", "atalanyado", "vszja", "tao", "kiva"] as const;
export type TaxMode = (typeof TAX_MODES)[number];

/** ÁFA-státusz: AAM (alanyi adómentes) or the VAT-return period of a registered taxpayer. */
export const VAT_REGIMES = ["aam", "monthly", "quarterly", "yearly"] as const;
export type VatRegime = (typeof VAT_REGIMES)[number];

/** Helyi iparűzési adó (HIPA): sávos (banded) or általános (general). */
export const HIPA_MODES = ["banded", "general"] as const;
export type HipaMode = (typeof HIPA_MODES)[number];

/** Document languages a number of places agree on (invoice/receipt/PDF/e-mail). */
export const DOCUMENT_LANGUAGES = ["hu", "en", "de", "fr", "es"] as const;
export type DocumentLanguage = (typeof DOCUMENT_LANGUAGES)[number];

export const DEFAULT_CURRENCIES = ["HUF", "EUR"] as const;
export const PAYMENT_METHODS: PaymentMethod[] = ["transfer", "cash", "card", "other"];
/** The VAT rates a default may name — see lib/invoices/types.ts VatRate. */
export const DEFAULT_VAT_RATES = [0, 5, 18, 27] as const;

export const MAX_PAYMENT_TERM_DAYS = 365;
export const MAX_DEFAULT_NOTE_LENGTH = 1000;

export type BillingSettings = {
  taxMode?: TaxMode;
  vatRegime?: VatRegime;
  hipaMode?: HipaMode;
  /** Invoice-number series prefix, e.g. "DC" → DC-2026-00018. */
  invoicePrefix?: string;
  defaultPaymentMethod?: PaymentMethod;
  defaultPaymentTermDays?: number;
  defaultCurrency?: string;
  defaultLanguage?: DocumentLanguage;
  defaultVatRate?: number;
  defaultNote?: string;
};

const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

export const isTaxMode = (v: unknown): v is TaxMode => oneOf(TAX_MODES, v);
export const isVatRegime = (v: unknown): v is VatRegime => oneOf(VAT_REGIMES, v);
export const isHipaMode = (v: unknown): v is HipaMode => oneOf(HIPA_MODES, v);
export const isDocumentLanguage = (v: unknown): v is DocumentLanguage => oneOf(DOCUMENT_LANGUAGES, v);

/**
 * Series prefix: 1–10 letters/digits, stored upper-case ("dc" → "DC"). Dashes
 * are not allowed because the number is PREFIX-YEAR-SEQ and a dash inside the
 * prefix would make it ambiguous to parse back.
 */
export function normalizeInvoicePrefix(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().toUpperCase();
  if (!v) return null;
  return /^[A-Z0-9]{1,10}$/.test(v) ? v : null;
}

export type BillingSettingsError = { field: keyof BillingSettings; code: string };

/**
 * Validates the settings present in a request body. Unknown/absent fields are
 * left out of `values`; a present-but-invalid field is reported in `errors`
 * (and not applied) instead of being silently dropped. An empty string clears
 * an optional text field (`null` in `values`).
 */
export function validateBillingSettings(body: Record<string, unknown>): {
  values: Partial<Record<keyof BillingSettings, string | number | null>>;
  errors: BillingSettingsError[];
} {
  const values: Partial<Record<keyof BillingSettings, string | number | null>> = {};
  const errors: BillingSettingsError[] = [];
  const bad = (field: keyof BillingSettings, code: string) => errors.push({ field, code });

  const enumField = (field: keyof BillingSettings, guard: (v: unknown) => boolean) => {
    if (!(field in body) || body[field] === undefined) return;
    const v = body[field];
    if (v === null || v === "") values[field] = null;
    else if (guard(v)) values[field] = v as string;
    else bad(field, "invalid");
  };
  enumField("taxMode", isTaxMode);
  enumField("vatRegime", isVatRegime);
  enumField("hipaMode", isHipaMode);
  enumField("defaultLanguage", isDocumentLanguage);
  enumField("defaultPaymentMethod", (v) => oneOf(PAYMENT_METHODS, v));
  enumField("defaultCurrency", (v) => typeof v === "string" && /^[A-Z]{3}$/.test(v));

  if ("invoicePrefix" in body && body.invoicePrefix !== undefined) {
    const raw = body.invoicePrefix;
    if (raw === null || raw === "") values.invoicePrefix = null;
    else {
      const prefix = typeof raw === "string" ? normalizeInvoicePrefix(raw) : null;
      if (prefix) values.invoicePrefix = prefix;
      else bad("invoicePrefix", "invalid");
    }
  }

  if ("defaultPaymentTermDays" in body && body.defaultPaymentTermDays !== undefined) {
    const raw = body.defaultPaymentTermDays;
    if (raw === null || raw === "") values.defaultPaymentTermDays = null;
    else if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= MAX_PAYMENT_TERM_DAYS) {
      values.defaultPaymentTermDays = raw;
    } else bad("defaultPaymentTermDays", "invalid");
  }

  if ("defaultVatRate" in body && body.defaultVatRate !== undefined) {
    const raw = body.defaultVatRate;
    if (raw === null || raw === "") values.defaultVatRate = null;
    else if (typeof raw === "number" && (DEFAULT_VAT_RATES as readonly number[]).includes(raw)) values.defaultVatRate = raw;
    else bad("defaultVatRate", "invalid");
  }

  if ("defaultNote" in body && body.defaultNote !== undefined) {
    const raw = body.defaultNote;
    if (raw === null || (typeof raw === "string" && !raw.trim())) values.defaultNote = null;
    else if (typeof raw === "string" && raw.length <= MAX_DEFAULT_NOTE_LENGTH) values.defaultNote = raw.trim();
    else bad("defaultNote", "invalid");
  }

  return { values, errors };
}
