import * as XLSX from "xlsx";
import { BULK_COLUMNS, BULK_MAX_ROWS } from "@/lib/bulk/columns";
import { parseCsvRecords, parseCsvText, parseSpreadsheetRecords } from "@/lib/bulk/parse";
import { runBulk } from "@/lib/bulk/run";
import { bulkTemplateCsv } from "@/lib/bulk/template";
import { parseBulkDate, parseBulkNumber, validateBulkRows } from "@/lib/bulk/validate";
import type { Invoice } from "@/lib/invoices/types";

const D = { today: "2026-10-21" };
const row = (over: Record<string, string> = {}) => ({
  type: "invoice", partner_name: "Minta Kft.", partner_zip: "1051", partner_city: "Budapest", partner_address: "Nádor u. 1.",
  description: "Havi díj", quantity: "1", unit_price: "10000", vat_rate: "27", ...over,
});

describe("parseCsvText / parseCsvRecords", () => {
  it("detects ',' ';' and tab, strips the BOM, handles quotes and blank lines", () => {
    for (const d of [",", ";", "\t"]) {
      const text = `﻿Partner Name${d}Description${d}Unit Price\r\n"Kiss; ""Bt."""${d}Munka${d}1 000\r\n\r\n`;
      expect(parseCsvRecords(text)).toEqual([{ partner_name: 'Kiss; "Bt."', description: "Munka", unit_price: "1 000" }]);
    }
  });
  it("keeps line breaks inside quoted fields", () => {
    expect(parseCsvText('a;b\r\n"x\ny";z\r\n')).toEqual([["a", "b"], ["x\ny", "z"]]);
  });
  it("round-trips the downloadable template", () => {
    const records = parseCsvRecords(bulkTemplateCsv());
    expect(records).toHaveLength(3);
    expect(Object.keys(records[0])).toEqual([...BULK_COLUMNS]);
    const { results } = validateBulkRows(records, D);
    expect(results.map((r) => r.errors)).toEqual([[], [], []]);
    expect(results.map((r) => (r.invoice ?? r.receipt)!.kind)).toEqual(["invoice", "proforma", "receipt"]);
  });
});

describe("parseSpreadsheetRecords", () => {
  it("reads the first sheet and turns Excel dates into ISO days", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["type", "partner_name", "issue_date", "unit_price", "description"],
      ["invoice", "Excel Kft.", new Date(2026, 9, 5), 2500, "Munka"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Sheet1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const [r] = parseSpreadsheetRecords(buf);
    expect(r).toMatchObject({ partner_name: "Excel Kft.", unit_price: "2500", issue_date: "2026-10-05" });
  });
});

describe("parseBulkDate / parseBulkNumber", () => {
  it("accepts ISO and Hungarian dotted dates, rejects impossible days", () => {
    expect(parseBulkDate("2026-10-05")).toBe("2026-10-05");
    expect(parseBulkDate("2026.10.5.")).toBe("2026-10-05");
    expect(parseBulkDate("2026-02-30")).toBeNull();
    expect(parseBulkDate("05/10/2026")).toBeNull();
  });
  it("reads Hungarian and English decimals and groupings", () => {
    expect(parseBulkNumber("1 234,5")).toBe(1234.5);
    expect(parseBulkNumber("1,234.50")).toBe(1234.5);
    expect(parseBulkNumber("1.234,50")).toBe(1234.5);
    expect(parseBulkNumber("1,234")).toBe(1234);
    expect(parseBulkNumber("12,5")).toBe(12.5);
    expect(parseBulkNumber("abc")).toBeNaN();
  });
});

describe("validateBulkRows", () => {
  it("fills defaults: today, term from the company, VAT, currency, language", () => {
    const { results } = validateBulkRows([row()], { ...D, defaultPaymentTermDays: 15, defaultLanguage: "en", defaultCurrency: "EUR", defaultVatRate: 18, defaultPaymentMethod: "card" });
    const inv = results[0].invoice!;
    expect(inv).toMatchObject({ issueDate: "2026-10-21", dueDate: "2026-11-05", currency: "EUR", language: "en", paymentMethod: "card", addressComplete: true });
    expect(inv.lineItem).toMatchObject({ vatRate: 27, vatCategory: "normal", unit: "db" }); // explicit 27 in the row wins
    const blankVat = validateBulkRows([row({ vat_rate: "" })], { ...D, defaultVatRate: 18 }).results[0].invoice!;
    expect(blankVat.lineItem.vatRate).toBe(18);
  });

  it("accepts any ISO currency code (USD, GBP, CHF…) and upper-cases it", () => {
    const usd = validateBulkRows([row({ currency: "usd", exchange_rate: "361,40" })], D).results[0].invoice!;
    expect(usd).toMatchObject({ currency: "USD", exchangeRate: 361.4 });
    expect(validateBulkRows([{ type: "receipt", description: "x", unit_price: "1", currency: "GBP" }], D).results[0].receipt!.currency).toBe("GBP");
  });

  it("backs the net out of a gross price, but not for an exempt line", () => {
    const gross = validateBulkRows([row({ unit_price: "25000", price_type: "gross" })], D).results[0].invoice!;
    expect(gross.lineItem.unitPrice).toBeCloseTo(19685.03937, 5);
    const aam = validateBulkRows([row({ unit_price: "25000", price_type: "gross", vat_rate: "AAM" })], D).results[0].invoice!;
    expect(aam.lineItem).toMatchObject({ unitPrice: 25000, vatRate: 0, vatCategory: "AAM" });
  });

  it("a VAT-exempt company defaults a blank rate to AAM", () => {
    const inv = validateBulkRows([row({ vat_rate: "" })], { ...D, vatExempt: true }).results[0].invoice!;
    expect(inv.lineItem).toMatchObject({ vatCategory: "AAM", vatRate: 0 });
  });

  it("reports every problem on a row with its column, and numbers rows as in the file (header = 1)", () => {
    const { results } = validateBulkRows(
      [row(), row({ type: "tax", partner_name: "", description: "", unit_price: "x", vat_rate: "20", issue_date: "2026-13-01", currency: "EURO", language: "xx", quantity: "0" })],
      D,
    );
    expect(results[0]).toMatchObject({ row: 2, errors: [] });
    expect(results[1].row).toBe(3);
    expect(results[1].errors.map((e) => e.field).sort()).toEqual(
      ["currency", "description", "issue_date", "language", "partner_name", "quantity", "type", "unit_price", "vat_rate"].sort(),
    );
    expect(results[1].invoice).toBeUndefined();
  });

  it("flags a due date before the issue date and a missing buyer address as incomplete (not an error)", () => {
    const bad = validateBulkRows([row({ issue_date: "2026-10-10", due_date: "2026-10-01" })], D).results[0];
    expect(bad.errors).toEqual([{ field: "due_date", code: "dueBeforeIssue" }]);
    const noAddr = validateBulkRows([row({ partner_zip: "", partner_city: "", partner_address: "" })], D).results[0];
    expect(noAddr.errors).toEqual([]);
    expect(noAddr.invoice!.addressComplete).toBe(false);
  });

  it("treats a receipt row separately: no partner needed, cash by default, receipt payment methods only", () => {
    const ok = validateBulkRows([{ type: "receipt", description: "Kávé", unit_price: "500" }], D).results[0];
    expect(ok.receipt).toMatchObject({ kind: "receipt", paymentMethod: "cash", currency: "HUF", language: "hu" });
    const bad = validateBulkRows([{ type: "receipt", description: "Kávé", unit_price: "500", payment_method: "other" }], D).results[0];
    expect(bad.errors).toEqual([{ field: "payment_method", code: "invalidChoice" }]);
  });

  it("caps an upload at the row limit", () => {
    const many = Array.from({ length: BULK_MAX_ROWS + 5 }, () => row());
    const { results, tooMany } = validateBulkRows(many, D);
    expect(tooMany).toBe(true);
    expect(results).toHaveLength(BULK_MAX_ROWS);
  });
});

describe("runBulk", () => {
  const rows = () => validateBulkRows([row(), row({ partner_name: "Másik Kft." }), { type: "receipt", description: "Kávé", unit_price: "500" }], D).results;

  function deps(over: Partial<Parameters<typeof runBulk>[2]> = {}) {
    const created: Invoice[] = [];
    return {
      created,
      deps: {
        existingClients: [{ id: "c-known", name: "Másik Kft.", taxNumber: undefined }],
        createClient: jest.fn(async (input) => ({ id: "c-new", userId: "u", createdAt: "", updatedAt: "", ...input })),
        createInvoice: jest.fn(async (inv: Invoice) => {
          created.push(inv);
          return { ...inv, invoiceNumber: inv.status === "draft" ? "" : "INV-2026-00001" };
        }),
        createReceipt: jest.fn(async () => ({ receiptNumber: "NYG-2026-00007" })),
        ...over,
      } as Parameters<typeof runBulk>[2],
    };
  }

  it("creates drafts by default, links partners (saving unknown ones once), and issues receipts", async () => {
    const { created, deps: d } = deps();
    const progress: number[] = [];
    const out = await runBulk(rows(), { issueNow: false }, d, (done) => progress.push(done));
    expect(out.map((o) => o.ok)).toEqual([true, true, true]);
    expect(created.map((i) => i.status)).toEqual(["draft", "draft"]);
    expect(created[0].clientId).toBe("c-new"); // new partner saved and linked
    expect(created[1].clientId).toBe("c-known"); // existing partner reused, not duplicated
    expect(d.createClient).toHaveBeenCalledTimes(1);
    expect(out[2].number).toBe("NYG-2026-00007");
    expect(progress).toEqual([1, 2, 3]);
  });

  it("issues straight away on request: invoices unpaid, proformas as proforma", async () => {
    const { created, deps: d } = deps();
    const res = validateBulkRows([row(), row({ type: "proforma" })], D).results;
    await runBulk(res, { issueNow: true }, d);
    expect(created.map((i) => i.status)).toEqual(["unpaid", "proforma"]);
    expect(created[0].language).toBe("hu");
  });

  it("skips rows with errors, and one failure does not stop the rest", async () => {
    const { deps: d } = deps();
    (d.createInvoice as jest.Mock).mockRejectedValueOnce(new Error("boom"));
    const res = validateBulkRows([row(), row({ description: "" }), row({ partner_name: "Harmadik Kft." })], D).results;
    const out = await runBulk(res, { issueNow: false }, d);
    expect(out).toEqual([
      { row: 2, ok: false, error: "boom" },
      { row: 4, ok: true, number: "" },
    ]);
  });
});
