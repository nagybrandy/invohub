// lib/invoices/tax-audit-export/selection.ts
// Which invoices an "adóhatósági ellenőrzési adatszolgáltatás" export
// covers. 23/2014. (VI. 30.) NGM rendelet 11/A. §: the export must be
// startable for
//   a) invoices issued in a period given by a start and end date
//      (year, month, day), or
//   b) invoices in a range given by a start and end invoice number.
// Pure: no I/O. The DB loading lives in ./generate.ts.
import type { Invoice } from "@/lib/invoices/types";

export type TaxAuditSelection =
  | { kind: "date"; from: string; to: string }
  | { kind: "number"; fromNumber: string; toNumber: string };

export type TaxAuditSelectionError =
  | "selectionRequired"
  | "ambiguousSelection"
  | "invalidDate"
  | "invalidNumber"
  | "numberSeriesMismatch"
  | "invalidRange";

export type TaxAuditSelectionResult =
  | { ok: true; selection: TaxAuditSelection }
  | { ok: false; code: TaxAuditSelectionError };

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Strict YYYY-MM-DD that is also a real calendar date (no 2026-02-30). */
export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export type ParsedInvoiceNumber = { prefix: string; year: number; seq: number };

/** InvoHub numbers are PREFIX-YYYY-NNNNN (lib/invoices/numbering.ts's formatDocumentNumber). */
export function parseInvoiceNumber(value: string): ParsedInvoiceNumber | null {
  const match = /^([A-Z]+)-(\d{4})-(\d+)$/.exec(value.trim());
  if (!match) return null;
  return { prefix: match[1], year: Number(match[2]), seq: Number(match[3]) };
}

/** Orders by series (prefix), then year, then sequence — numerically, never lexically. */
export function compareInvoiceNumbers(a: string, b: string): number {
  const pa = parseInvoiceNumber(a);
  const pb = parseInvoiceNumber(b);
  if (!pa || !pb) return a.localeCompare(b);
  if (pa.prefix !== pb.prefix) return pa.prefix < pb.prefix ? -1 : 1;
  if (pa.year !== pb.year) return pa.year - pb.year;
  return pa.seq - pb.seq;
}

export function parseTaxAuditSelection(params: URLSearchParams): TaxAuditSelectionResult {
  const from = params.get("from")?.trim() ?? "";
  const to = params.get("to")?.trim() ?? "";
  const fromNumber = params.get("fromNumber")?.trim() ?? "";
  const toNumber = params.get("toNumber")?.trim() ?? "";

  const wantsDate = Boolean(from || to);
  const wantsNumber = Boolean(fromNumber || toNumber);

  if (wantsDate && wantsNumber) return { ok: false, code: "ambiguousSelection" };
  if (!wantsDate && !wantsNumber) return { ok: false, code: "selectionRequired" };

  if (wantsDate) {
    if (!isValidIsoDate(from) || !isValidIsoDate(to)) return { ok: false, code: "invalidDate" };
    if (from > to) return { ok: false, code: "invalidRange" };
    return { ok: true, selection: { kind: "date", from, to } };
  }

  const parsedFrom = parseInvoiceNumber(fromNumber);
  const parsedTo = parseInvoiceNumber(toNumber);
  if (!parsedFrom || !parsedTo) return { ok: false, code: "invalidNumber" };
  if (parsedFrom.prefix !== parsedTo.prefix) return { ok: false, code: "numberSeriesMismatch" };
  if (compareInvoiceNumbers(fromNumber, toNumber) > 0) return { ok: false, code: "invalidRange" };
  return { ok: true, selection: { kind: "number", fromNumber, toNumber } };
}

/**
 * Only issued accounting documents belong in the export: never a draft
 * (no number, not issued), never a díjbekérő/proforma (not a számla under
 * Áfa tv. 169. §). Storno (érvénytelenítő) and helyesbítő (módosító)
 * documents are invoices in their own right and ARE exported, as are
 * originals that were later cancelled.
 */
export function isIssuedAccountingDocument(invoice: Invoice): boolean {
  if (invoice.status === "draft") return false;
  if (invoice.documentType === "proforma" || invoice.status === "proforma") return false;
  return invoice.invoiceNumber.trim().length > 0;
}

export function selectInvoicesForExport(invoices: Invoice[], selection: TaxAuditSelection): Invoice[] {
  const issued = invoices.filter(isIssuedAccountingDocument);

  const inRange =
    selection.kind === "date"
      ? issued.filter((inv) => inv.issueDate >= selection.from && inv.issueDate <= selection.to)
      : issued.filter((inv) => {
          const parsed = parseInvoiceNumber(inv.invoiceNumber);
          const lower = parseInvoiceNumber(selection.fromNumber);
          if (!parsed || !lower || parsed.prefix !== lower.prefix) return false;
          return (
            compareInvoiceNumbers(inv.invoiceNumber, selection.fromNumber) >= 0 &&
            compareInvoiceNumbers(inv.invoiceNumber, selection.toNumber) <= 0
          );
        });

  return [...inRange].sort((a, b) => compareInvoiceNumbers(a.invoiceNumber, b.invoiceNumber));
}
