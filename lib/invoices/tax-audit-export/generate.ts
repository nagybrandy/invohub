// lib/invoices/tax-audit-export/generate.ts
// Loads the caller's own invoices for an "adóhatósági ellenőrzési
// adatszolgáltatás" selection (23/2014. NGM rendelet 11/A. §) and turns
// them into the 3. melléklet XML via ./build-xml.ts. Every query is scoped
// to userId; nothing here trusts an id coming from the request.
import { budapestDateKey } from "@/lib/dates/budapest";
import { getCompanyByUserId } from "@/lib/companies/service";
import { getInvoiceById, listInvoicesInDateRange } from "@/lib/invoices/service";
import type { Invoice } from "@/lib/invoices/types";
import { buildTaxAuditExportXml, type TaxAuditProblem } from "@/lib/invoices/tax-audit-export/build-xml";
import {
  parseInvoiceNumber,
  selectInvoicesForExport,
  type TaxAuditSelection,
} from "@/lib/invoices/tax-audit-export/selection";

/**
 * Upper bound per file, so one request can't build an unbounded document.
 * NAV's guidance allows splitting a very large export into several files
 * (nav.gov.hu "A számlázó programok adóhatósági ellenőrzési adatszolgáltatás
 * funkciója"), so the user narrows the range instead.
 */
export const TAX_AUDIT_MAX_INVOICES = 5000;

export type GenerateTaxAuditExportResult =
  | { ok: true; xml: string; invoiceCount: number; filename: string }
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "tooMany"; limit: number }
  | { ok: false; reason: "problems"; problems: TaxAuditProblem[] };

const FILE_PREFIX = "adohatosagi-ellenorzesi-adatszolgaltatas";

async function loadCandidates(userId: string, selection: TaxAuditSelection): Promise<Invoice[]> {
  if (selection.kind === "date") {
    return listInvoicesInDateRange(userId, selection.from, selection.to);
  }
  // A number's year is its issue year (lib/invoices/service.ts assigns
  // numbers from issueYearOf(issueDate)), so the numbers' years bound the
  // issue dates to load; selectInvoicesForExport then applies the exact range.
  const fromYear = parseInvoiceNumber(selection.fromNumber)?.year;
  const toYear = parseInvoiceNumber(selection.toNumber)?.year;
  if (!fromYear || !toYear) return [];
  return listInvoicesInDateRange(userId, `${fromYear}-01-01`, `${toYear}-12-31`);
}

async function resolveOriginalNumbers(
  userId: string,
  selected: Invoice[],
  loaded: Invoice[]
): Promise<Record<string, string>> {
  const byId = new Map(loaded.map((inv) => [inv.id, inv.invoiceNumber]));
  const numbers: Record<string, string> = {};
  for (const invoice of selected) {
    const refId = invoice.originalInvoiceId ?? invoice.modifiesInvoiceId;
    if (!refId || numbers[refId]) continue;
    const known = byId.get(refId);
    if (known) {
      numbers[refId] = known;
      continue;
    }
    const original = await getInvoiceById(userId, refId);
    if (original?.invoiceNumber) numbers[refId] = original.invoiceNumber;
  }
  return numbers;
}

export async function generateTaxAuditExport(
  userId: string,
  selection: TaxAuditSelection,
  now: Date = new Date()
): Promise<GenerateTaxAuditExportResult> {
  const loaded = await loadCandidates(userId, selection);
  const selected = selectInvoicesForExport(loaded, selection);

  if (selected.length === 0) return { ok: false, reason: "empty" };
  if (selected.length > TAX_AUDIT_MAX_INVOICES) {
    return { ok: false, reason: "tooMany", limit: TAX_AUDIT_MAX_INVOICES };
  }

  const [company, originalInvoiceNumbers] = await Promise.all([
    getCompanyByUserId(userId),
    resolveOriginalNumbers(userId, selected, loaded),
  ]);

  const issueDates = selected.map((inv) => inv.issueDate.slice(0, 10)).sort();
  const period =
    selection.kind === "date"
      ? { from: selection.from, to: selection.to }
      : { from: issueDates[0], to: issueDates[issueDates.length - 1] };

  const result = buildTaxAuditExportXml({
    invoices: selected,
    company,
    originalInvoiceNumbers,
    period,
    exportDate: budapestDateKey(now),
  });
  if (!result.ok) return { ok: false, reason: "problems", problems: result.problems };

  const rangeLabel =
    selection.kind === "date"
      ? `${selection.from}_${selection.to}`
      : `${selection.fromNumber}_${selection.toNumber}`;

  return {
    ok: true,
    xml: result.xml,
    invoiceCount: result.invoiceCount,
    filename: `${FILE_PREFIX}_${rangeLabel}.xml`,
  };
}
