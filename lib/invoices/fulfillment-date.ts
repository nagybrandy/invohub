// lib/invoices/fulfillment-date.ts
// Teljesítés dátuma (Áfa tv. 169. § performance date) helpers. Pure — no DB
// imports — shared by lib/invoices/mappers.ts (read-time legacy fallback),
// lib/invoices/create-from-payload.ts, and app/api/invoices*+api.ts (input
// normalization). Mirrors lib/invoices/payment-status.ts's
// "real column now, used to live in notes" shape.
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
// Accepts "Teljesítés:" and the accentless "Teljesites:" spelling.
const NOTES_LINE_RE = /Teljes[ií]t[eé]s:\s*([^\n]+)/i;

/** True only for a real calendar date, e.g. rejects "2026-13-45". */
function isValidCalendarDate(dateOnly: string): boolean {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** The leading YYYY-MM-DD of a string, if it starts with one and it's a real date. */
function extractValidDateOnly(value: string): string | undefined {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  const dateOnly = match?.[1];
  if (!dateOnly) return undefined;
  return isValidCalendarDate(dateOnly) ? dateOnly : undefined;
}

/**
 * Older invoices had no fulfillment_date column — the value lived inside
 * notes as a "Teljesítés: <date>" line (composeInvoiceNotes used to append
 * it). Parse it out so old invoices still resolve a fulfillment date until
 * they're resaved. Tolerant of the accentless "Teljesites:" spelling and of
 * a trailing time part; never returns a non-YYYY-MM-DD string.
 */
export function parseFulfillmentDateFromNotes(notes?: string | null): string | undefined {
  if (!notes) return undefined;
  const match = notes.match(NOTES_LINE_RE);
  const raw = match?.[1]?.trim();
  if (!raw) return undefined;
  return extractValidDateOnly(raw);
}

/** fulfillment_date column wins; falls back to parsing the legacy notes text. */
export function resolveFulfillmentDate(
  column: string | null | undefined,
  notes?: string | null
): string | undefined {
  return column ?? parseFulfillmentDateFromNotes(notes);
}

/**
 * Normalizes user/API input for the fulfillment date field.
 * - `undefined` — absent/blank (not an error; the field is optional).
 * - `null` — the "invalid" signal: present but not a YYYY-MM-DD date (nor a
 *   parseable ISO datetime whose date part is valid). Callers reject it
 *   (validateExternalInvoiceInput) or normalize it away instead of
 *   persisting it raw (the app-internal API routes).
 * - a `YYYY-MM-DD` string otherwise — a parseable ISO datetime is sliced to
 *   its date part.
 */
export function normalizeFulfillmentDateInput(raw: unknown): string | undefined | null {
  if (raw == null) return undefined;
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  if (DATE_ONLY_RE.test(trimmed)) {
    return isValidCalendarDate(trimmed) ? trimmed : null;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const datePart = extractValidDateOnly(trimmed);
    if (datePart) return datePart;
  }

  return null;
}
