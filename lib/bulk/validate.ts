// lib/bulk/validate.ts
// Raw rows → documents ready to create, or per-row errors the user can fix in
// the file. Pure: no network, no clock (today is passed in).
import { isCurrencyCode } from "@/lib/currency/currencies";
import { BULK_DOCUMENT_TYPES, BULK_MAX_ROWS, type BulkDocumentType } from "@/lib/bulk/columns";
import type { RawRow } from "@/lib/bulk/parse";
import { DOCUMENT_LANGUAGES, PAYMENT_METHODS, type DocumentLanguage } from "@/lib/companies/billing-settings";
import type { ClientInput } from "@/lib/clients/service";
import { netFromGross } from "@/lib/invoices/unit-price";
import type { InvoiceCurrency, InvoiceLineItem, PaymentMethod, VatCategory, VatRate } from "@/lib/invoices/types";

export type BulkDefaults = {
  today: string; // YYYY-MM-DD
  defaultCurrency?: string;
  defaultPaymentMethod?: PaymentMethod;
  defaultPaymentTermDays?: number;
  defaultVatRate?: number;
  defaultLanguage?: DocumentLanguage;
  /** Company is alanyi adómentes: a blank vat_rate means AAM. */
  vatExempt?: boolean;
};

export type BulkRowError = { field: string; code: string };

export type BulkInvoiceRow = {
  kind: "invoice" | "proforma" | "advance";
  partner: ClientInput;
  issueDate: string;
  fulfillmentDate: string;
  dueDate: string;
  currency: InvoiceCurrency;
  exchangeRate?: number;
  paymentMethod: PaymentMethod;
  language: DocumentLanguage;
  lineItem: Omit<InvoiceLineItem, "id">;
  notes?: string;
  /** Missing buyer address — fine for a draft, blocks issuing straight away (Áfa tv. 169. § e). */
  addressComplete: boolean;
};

export type BulkReceiptRow = {
  kind: "receipt";
  currency: string;
  paymentMethod: "cash" | "card" | "transfer" | "voucher";
  language: DocumentLanguage;
  lineItem: { description: string; quantity: number; unitPrice: number; vatRate: number; unit: string };
};

export type BulkRowResult = {
  /** Row number as the user sees it in the file (header = 1). */
  row: number;
  errors: BulkRowError[];
  invoice?: BulkInvoiceRow;
  receipt?: BulkReceiptRow;
};

const CATEGORIES = ["AAM", "TAM", "KBAET", "AHK", "FAD", "ATK"] as const;
const TAXED_RATES = [0, 5, 18, 27];
const RECEIPT_METHODS = ["cash", "card", "transfer", "voucher"] as const;

/** YYYY-MM-DD or YYYY.MM.DD(.) → ISO, or null when not a real calendar date. */
export function parseBulkDate(value: string): string | null {
  const m = value.trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})\.?$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "1 234,5" / "1234.5" / "1,234.50" → number, or NaN. */
export function parseBulkNumber(value: string): number {
  let v = value.trim().replace(/[\s ]/g, "");
  if (!v) return NaN;
  const lastComma = v.lastIndexOf(",");
  const lastDot = v.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // the later one is the decimal separator
    v = lastComma > lastDot ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "");
  } else if (lastComma > -1) {
    // a lone comma: decimal separator unless it groups exactly three digits ("1,234")
    v = /^\d{1,3}(,\d{3})+$/.test(v) ? v.replace(/,/g, "") : v.replace(",", ".");
  }
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
}

export function validateBulkRows(rows: RawRow[], defaults: BulkDefaults): { results: BulkRowResult[]; tooMany: boolean } {
  const tooMany = rows.length > BULK_MAX_ROWS;
  const results = rows.slice(0, BULK_MAX_ROWS).map((raw, index) => validateRow(raw, index + 2, defaults));
  return { results, tooMany };
}

function validateRow(raw: RawRow, rowNumber: number, d: BulkDefaults): BulkRowResult {
  const errors: BulkRowError[] = [];
  const err = (field: string, code: string) => errors.push({ field, code });
  const get = (k: string) => (raw[k] ?? "").trim();

  const rawType = get("type").toLowerCase() || "invoice";
  const type = (BULK_DOCUMENT_TYPES as readonly string[]).includes(rawType) ? (rawType as BulkDocumentType) : null;
  if (!type) err("type", "invalidType");
  const isReceipt = type === "receipt";

  // --- shared fields
  const description = get("description");
  if (!description) err("description", "required");

  const quantityRaw = get("quantity");
  const quantity = quantityRaw ? parseBulkNumber(quantityRaw) : 1;
  if (!(quantity > 0)) err("quantity", "invalidNumber");

  const priceRaw = get("unit_price");
  const unitPriceTyped = priceRaw ? parseBulkNumber(priceRaw) : NaN;
  if (!priceRaw) err("unit_price", "required");
  else if (!(unitPriceTyped >= 0)) err("unit_price", "invalidNumber");

  const priceType = (get("price_type").toLowerCase() || "net");
  if (priceType !== "net" && priceType !== "gross") err("price_type", "invalidChoice");

  // vat_rate: a number (27/18/5/0) or an exemption category (AAM, TAM, …)
  const vatRaw = get("vat_rate").replace("%", "");
  let vatRate: number = d.defaultVatRate ?? 27;
  let vatCategory: VatCategory = d.vatExempt && !vatRaw ? "AAM" : "normal";
  if (d.vatExempt && !vatRaw) vatRate = 0;
  if (vatRaw) {
    const upper = vatRaw.toUpperCase();
    if ((CATEGORIES as readonly string[]).includes(upper)) {
      vatCategory = upper as VatCategory;
      vatRate = 0;
    } else {
      const n = parseBulkNumber(vatRaw);
      if (TAXED_RATES.includes(n)) {
        vatRate = n;
        vatCategory = "normal";
      } else err("vat_rate", "invalidVatRate");
    }
  }

  const currencyRaw = (get("currency") || d.defaultCurrency || "HUF").toUpperCase();
  // Any ISO code is accepted here; a currency the MNB has no rate for ends up
  // with no automatic rate and the invoice asks for one (needs-exchange-rate).
  const currency = isCurrencyCode(currencyRaw) ? currencyRaw : null;
  if (!currency) err("currency", "invalidCurrency");

  const langRaw = (get("language") || d.defaultLanguage || "hu").toLowerCase();
  const language = (DOCUMENT_LANGUAGES as readonly string[]).includes(langRaw) ? (langRaw as DocumentLanguage) : null;
  if (!language) err("language", "invalidChoice");

  const unit = get("unit") || "db";

  const netUnitPrice =
    Number.isFinite(unitPriceTyped) && priceType === "gross" && vatCategory === "normal"
      ? netFromGross(unitPriceTyped, { vatRate: vatRate as VatRate, vatCategory })
      : unitPriceTyped;

  // --- receipt
  if (isReceipt) {
    const methodRaw = (get("payment_method") || "cash").toLowerCase();
    const method = (RECEIPT_METHODS as readonly string[]).includes(methodRaw) ? (methodRaw as BulkReceiptRow["paymentMethod"]) : null;
    if (!method) err("payment_method", "invalidChoice");
    if (errors.length > 0 || !currency || !language || !method) return { row: rowNumber, errors };
    return {
      row: rowNumber,
      errors,
      receipt: {
        kind: "receipt",
        currency,
        paymentMethod: method,
        language,
        lineItem: { description, quantity, unitPrice: netUnitPrice, vatRate: vatCategory === "normal" ? vatRate : 0, unit },
      },
    };
  }

  // --- invoice / proforma / advance
  const partnerName = get("partner_name");
  if (!partnerName) err("partner_name", "required");

  const dateOr = (field: string, fallback: string): string => {
    const v = get(field);
    if (!v) return fallback;
    const iso = parseBulkDate(v);
    if (!iso) err(field, "invalidDate");
    return iso ?? fallback;
  };
  const issueDate = dateOr("issue_date", d.today);
  const fulfillmentDate = dateOr("fulfillment_date", issueDate);
  const dueDate = dateOr("due_date", addDays(issueDate, d.defaultPaymentTermDays ?? 8));
  if (dueDate < issueDate) err("due_date", "dueBeforeIssue");

  const methodRaw = (get("payment_method") || d.defaultPaymentMethod || "transfer").toLowerCase();
  const paymentMethod = (PAYMENT_METHODS as string[]).includes(methodRaw) ? (methodRaw as PaymentMethod) : null;
  if (!paymentMethod) err("payment_method", "invalidChoice");

  let exchangeRate: number | undefined;
  const rateRaw = get("exchange_rate");
  if (rateRaw) {
    const n = parseBulkNumber(rateRaw);
    if (n > 0) exchangeRate = n;
    else err("exchange_rate", "invalidNumber");
  }

  if (errors.length > 0 || !type || !currency || !language || !paymentMethod) return { row: rowNumber, errors };

  const zip = get("partner_zip");
  const city = get("partner_city");
  const address = get("partner_address");
  const country = get("partner_country");
  return {
    row: rowNumber,
    errors,
    invoice: {
      kind: type as BulkInvoiceRow["kind"],
      partner: {
        name: partnerName,
        taxNumber: get("partner_tax_number") || undefined,
        email: get("partner_email") || undefined,
        country: country || undefined,
        zipCode: zip || undefined,
        city: city || undefined,
        address: address || undefined,
      },
      issueDate,
      fulfillmentDate,
      dueDate,
      currency,
      exchangeRate: currency === "HUF" ? undefined : exchangeRate,
      paymentMethod,
      language,
      lineItem: {
        description,
        quantity,
        unitPrice: netUnitPrice,
        vatRate: (vatCategory === "normal" ? vatRate : 0) as VatRate,
        vatCategory,
        unit,
        comment: get("comment") || undefined,
      },
      notes: get("note") || undefined,
      addressComplete: Boolean(zip && city && address),
    },
  };
}
