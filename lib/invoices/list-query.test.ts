// lib/invoices/list-query.test.ts
import {
  buildInvoiceListQueryString,
  invoiceMatchesListFilters,
  normalizeInvoiceListFilters,
} from "@/lib/invoices/list-query";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

describe("normalizeInvoiceListFilters", () => {
  it("keeps valid status and trims search", () => {
    expect(
      normalizeInvoiceListFilters({ status: "draft", search: "  Acme  " }),
    ).toEqual({ status: "draft", search: "Acme" });
  });

  it("drops invalid status and empty search", () => {
    expect(
      normalizeInvoiceListFilters({ status: "nope", search: "   " }),
    ).toEqual({});
  });
});

describe("invoiceMatchesListFilters", () => {
  const invoice = makeInvoice({
    status: "sent",
    clientName: "Acme Kft.",
    invoiceNumber: "INV-2026-042",
    clientTaxNumber: "12345678-1-23",
  });

  it("filters by status", () => {
    expect(invoiceMatchesListFilters(invoice, { status: "sent" })).toBe(true);
    expect(invoiceMatchesListFilters(invoice, { status: "draft" })).toBe(false);
  });

  it("matches search against name, number, or tax id", () => {
    expect(invoiceMatchesListFilters(invoice, { search: "acme" })).toBe(true);
    expect(invoiceMatchesListFilters(invoice, { search: "042" })).toBe(true);
    expect(invoiceMatchesListFilters(invoice, { search: "12345678" })).toBe(true);
    expect(invoiceMatchesListFilters(invoice, { search: "zzz" })).toBe(false);
  });
});

describe("buildInvoiceListQueryString", () => {
  it("encodes limit, status, and search", () => {
    expect(
      buildInvoiceListQueryString({
        limit: 30,
        status: "paid",
        search: "Acme",
      }),
    ).toBe("limit=30&status=paid&search=Acme");
  });

  it("omits all-status and blank search", () => {
    expect(
      buildInvoiceListQueryString({
        limit: 30,
        status: "all",
        search: "  ",
      }),
    ).toBe("limit=30");
  });
});
