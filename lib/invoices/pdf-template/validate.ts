// lib/invoices/pdf-template/validate.ts
// Pure validation of the PDF appearance a client sends to PATCH / POST
// /api/pdf-template. Strict on purpose: nothing is silently coerced or
// replaced by a default (the service still re-normalizes on write and read,
// so render safety never depends on this, but a client deserves a 400 rather
// than a quietly different look).
import {
  PDF_FONT_SCALES,
  PDF_FONT_STYLES,
  PDF_SELECTABLE_LAYOUTS,
  PDF_LOGO_MODES,
  PDF_LOGO_POSITIONS,
  PDF_LOGO_SIZES,
} from "@/lib/invoices/pdf-template/defaults";
import type { InvoicePdfTemplateInput } from "@/lib/invoices/pdf-template/types";

export const PDF_TITLE_MAX_LENGTH = 40;
export const PDF_NOTES_LABEL_MAX_LENGTH = 40;
export const PDF_FOOTER_MAX_LENGTH = 200;

export type PdfTemplateValidation =
  | { ok: true; value: InvoicePdfTemplateInput }
  | { ok: false; fields: string[] };

type FieldRule = (value: unknown, stored?: unknown) => { ok: true; value: unknown } | { ok: false };

const enumOf =
  (allowed: readonly string[]): FieldRule =>
  (value) =>
    typeof value === "string" && allowed.includes(value) ? { ok: true, value } : { ok: false };

const bool: FieldRule = (value) => (typeof value === "boolean" ? { ok: true, value } : { ok: false });

const text =
  (max: number): FieldRule =>
  (value, stored) => {
    if (typeof value !== "string") return { ok: false };
    const trimmed = value.trim();
    // The limits are new; the old settings screen had none and the old service
    // never truncated. A text that is exactly what the user already has stored
    // is accepted whatever its length, otherwise a legacy user with a long
    // title or footer could not save any other change (the old screen PATCHes
    // the whole template back).
    if (typeof stored === "string" && stored.trim() === trimmed) return { ok: true, value: trimmed };
    return trimmed.length <= max ? { ok: true, value: trimmed } : { ok: false };
  };

/** #RGB or #RRGGBB; #RGB is expanded to six digits, the case is kept. */
const hexColor: FieldRule = (value) => {
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return { ok: true, value: trimmed };
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return { ok: true, value: `#${r}${r}${g}${g}${b}${b}` };
  }
  return { ok: false };
};

// Order is the order `fields` is reported in.
const RULES: Array<[keyof InvoicePdfTemplateInput, FieldRule]> = [
  ["layout", enumOf(PDF_SELECTABLE_LAYOUTS)],
  ["fontStyle", enumOf(PDF_FONT_STYLES)],
  ["logoMode", enumOf(PDF_LOGO_MODES)],
  ["logoSize", enumOf(PDF_LOGO_SIZES)],
  ["logoPosition", enumOf(PDF_LOGO_POSITIONS)],
  ["fontScale", enumOf(PDF_FONT_SCALES)],
  ["accentColor", hexColor],
  ["showCompanyBlock", bool],
  ["showBankDetails", bool],
  ["showClientTaxNumber", bool],
  ["titleText", text(PDF_TITLE_MAX_LENGTH)],
  ["notesLabel", text(PDF_NOTES_LABEL_MAX_LENGTH)],
  ["footerText", text(PDF_FOOTER_MAX_LENGTH)],
];

/**
 * `stored` is the template the user has saved now (when known): an
 * over-limit text that equals the stored one is not rejected (see `text`).
 */
export function validatePdfTemplateInput(
  body: unknown,
  stored?: Partial<Record<keyof InvoicePdfTemplateInput, unknown>> | null
): PdfTemplateValidation {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, fields: ["body"] };
  }
  const raw = body as Record<string, unknown>;
  const value: Record<string, unknown> = {};
  const fields: string[] = [];
  for (const [key, rule] of RULES) {
    if (!(key in raw) || raw[key] === undefined) continue;
    const result = rule(raw[key], stored?.[key]);
    if (result.ok) value[key] = result.value;
    else fields.push(key);
  }
  return fields.length > 0 ? { ok: false, fields } : { ok: true, value: value as InvoicePdfTemplateInput };
}
