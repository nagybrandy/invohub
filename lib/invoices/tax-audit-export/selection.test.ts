// lib/invoices/tax-audit-export/selection.test.ts
import { makeInvoice } from "@/__tests__/fixtures/invoices";
import {
  compareInvoiceNumbers,
  isIssuedAccountingDocument,
  parseInvoiceNumber,
  parseTaxAuditSelection,
  selectInvoicesForExport,
} from "@/lib/invoices/tax-audit-export/selection";

function params(query: string) {
  return new URLSearchParams(query);
}

describe("parseTaxAuditSelection", () => {
  it("accepts a date range (23/2014. NGM rendelet 11/A. § a))", () => {
    expect(parseTaxAuditSelection(params("from=2026-01-01&to=2026-03-31"))).toEqual({
      ok: true,
      selection: { kind: "date", from: "2026-01-01", to: "2026-03-31" },
    });
  });

  it("accepts an invoice number range (11/A. § b))", () => {
    expect(
      parseTaxAuditSelection(params("fromNumber=INV-2026-00001&toNumber=INV-2026-00010"))
    ).toEqual({
      ok: true,
      selection: { kind: "number", fromNumber: "INV-2026-00001", toNumber: "INV-2026-00010" },
    });
  });

  it("rejects a missing selection", () => {
    expect(parseTaxAuditSelection(params(""))).toEqual({ ok: false, code: "selectionRequired" });
  });

  it("rejects mixing a date range with a number range", () => {
    expect(
      parseTaxAuditSelection(
        params("from=2026-01-01&to=2026-01-31&fromNumber=INV-2026-00001&toNumber=INV-2026-00002")
      )
    ).toEqual({ ok: false, code: "ambiguousSelection" });
  });

  it("rejects malformed or impossible dates and reversed ranges", () => {
    expect(parseTaxAuditSelection(params("from=2026-1-1&to=2026-01-31"))).toEqual({
      ok: false,
      code: "invalidDate",
    });
    expect(parseTaxAuditSelection(params("from=2026-02-30&to=2026-03-01"))).toEqual({
      ok: false,
      code: "invalidDate",
    });
    expect(parseTaxAuditSelection(params("from=2026-03-01&to=2026-02-01"))).toEqual({
      ok: false,
      code: "invalidRange",
    });
  });

  it("rejects a half-open date range", () => {
    expect(parseTaxAuditSelection(params("from=2026-01-01"))).toEqual({
      ok: false,
      code: "invalidDate",
    });
  });

  it("rejects number ranges that are unparseable, span two series, or are reversed", () => {
    expect(parseTaxAuditSelection(params("fromNumber=abc&toNumber=INV-2026-00002"))).toEqual({
      ok: false,
      code: "invalidNumber",
    });
    expect(
      parseTaxAuditSelection(params("fromNumber=INV-2026-00001&toNumber=ELO-2026-00002"))
    ).toEqual({ ok: false, code: "numberSeriesMismatch" });
    expect(
      parseTaxAuditSelection(params("fromNumber=INV-2026-00005&toNumber=INV-2026-00002"))
    ).toEqual({ ok: false, code: "invalidRange" });
  });

  it("trims whitespace around invoice numbers", () => {
    const result = parseTaxAuditSelection(
      params("fromNumber=%20INV-2026-00001%20&toNumber=INV-2026-00003")
    );
    expect(result).toEqual({
      ok: true,
      selection: { kind: "number", fromNumber: "INV-2026-00001", toNumber: "INV-2026-00003" },
    });
  });
});

describe("parseInvoiceNumber / compareInvoiceNumbers", () => {
  it("parses InvoHub's PREFIX-YYYY-NNNNN numbers", () => {
    expect(parseInvoiceNumber("INV-2026-00042")).toEqual({ prefix: "INV", year: 2026, seq: 42 });
    expect(parseInvoiceNumber("nope")).toBeNull();
  });

  it("orders numerically across years, not lexically", () => {
    expect(compareInvoiceNumbers("INV-2026-00009", "INV-2026-00010")).toBeLessThan(0);
    expect(compareInvoiceNumbers("INV-2027-00001", "INV-2026-99999")).toBeGreaterThan(0);
  });
});

describe("isIssuedAccountingDocument", () => {
  it("excludes drafts, proformas (díjbekérő) and unnumbered rows", () => {
    expect(isIssuedAccountingDocument(makeInvoice({ status: "draft" }))).toBe(false);
    expect(
      isIssuedAccountingDocument(makeInvoice({ documentType: "proforma", status: "proforma" }))
    ).toBe(false);
    expect(isIssuedAccountingDocument(makeInvoice({ invoiceNumber: "" }))).toBe(false);
  });

  it("includes issued invoices, advance invoices, storno and modify documents, and cancelled originals", () => {
    expect(isIssuedAccountingDocument(makeInvoice({ status: "unpaid" }))).toBe(true);
    expect(isIssuedAccountingDocument(makeInvoice({ documentType: "advance" }))).toBe(true);
    expect(isIssuedAccountingDocument(makeInvoice({ documentType: "storno" }))).toBe(true);
    expect(isIssuedAccountingDocument(makeInvoice({ documentType: "modify" }))).toBe(true);
    expect(isIssuedAccountingDocument(makeInvoice({ status: "cancelled" }))).toBe(true);
  });
});

describe("selectInvoicesForExport", () => {
  const invoices = [
    makeInvoice({ id: "a", invoiceNumber: "INV-2026-00003", issueDate: "2026-02-10" }),
    makeInvoice({ id: "b", invoiceNumber: "INV-2026-00001", issueDate: "2026-01-05" }),
    makeInvoice({ id: "c", invoiceNumber: "", status: "draft", issueDate: "2026-01-06" }),
    makeInvoice({ id: "d", invoiceNumber: "DBK-2026-00001", documentType: "proforma", status: "proforma" }),
    makeInvoice({ id: "e", invoiceNumber: "ELO-2026-00001", documentType: "advance", issueDate: "2026-01-20" }),
    makeInvoice({ id: "f", invoiceNumber: "INV-2026-00002", documentType: "storno", issueDate: "2026-01-30" }),
  ];

  it("date range: keeps only issued accounting documents, sorted by series then number", () => {
    const selected = selectInvoicesForExport(invoices, {
      kind: "date",
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(selected.map((inv) => inv.id)).toEqual(["e", "b", "f", "a"]);
  });

  it("date range: bounds are inclusive on issue date", () => {
    const selected = selectInvoicesForExport(invoices, {
      kind: "date",
      from: "2026-01-05",
      to: "2026-01-30",
    });
    expect(selected.map((inv) => inv.id)).toEqual(["e", "b", "f"]);
  });

  it("number range: keeps only the same series within the inclusive bounds", () => {
    const selected = selectInvoicesForExport(invoices, {
      kind: "number",
      fromNumber: "INV-2026-00002",
      toNumber: "INV-2026-00003",
    });
    expect(selected.map((inv) => inv.id)).toEqual(["f", "a"]);
  });
});
