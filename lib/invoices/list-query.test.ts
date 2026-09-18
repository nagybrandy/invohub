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

  it("accepts needsExchangeRate '1' or 'true' (AC2.1, AC2.2)", () => {
    expect(normalizeInvoiceListFilters({ needsExchangeRate: "1" })).toEqual({
      needsExchangeRate: true,
    });
    expect(normalizeInvoiceListFilters({ needsExchangeRate: "true" })).toEqual({
      needsExchangeRate: true,
    });
  });

  it("drops any other needsExchangeRate value (AC2.2)", () => {
    for (const value of [null, "", "0", "false", "yes"]) {
      expect(normalizeInvoiceListFilters({ needsExchangeRate: value }).needsExchangeRate).toBeUndefined();
    }
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

  it("keeps an affected EUR invoice and rejects a HUF one or an EUR invoice with a rate (AC2.3)", () => {
    const eurMissing = makeInvoice({ currency: "EUR", exchangeRate: undefined });
    const eurWithRate = makeInvoice({ currency: "EUR", exchangeRate: 390.5 });
    const huf = makeInvoice({ currency: "HUF" });

    expect(invoiceMatchesListFilters(eurMissing, { needsExchangeRate: true })).toBe(true);
    expect(invoiceMatchesListFilters(eurWithRate, { needsExchangeRate: true })).toBe(false);
    expect(invoiceMatchesListFilters(huf, { needsExchangeRate: true })).toBe(false);
  });

  it("composes needsExchangeRate with status and search — all three must match (AC2.4)", () => {
    const eurMissing = makeInvoice({
      currency: "EUR",
      exchangeRate: undefined,
      status: "sent",
      clientName: "Acme Kft.",
    });

    expect(
      invoiceMatchesListFilters(eurMissing, {
        needsExchangeRate: true,
        status: "sent",
        search: "acme",
      })
    ).toBe(true);

    expect(
      invoiceMatchesListFilters(eurMissing, {
        needsExchangeRate: true,
        status: "draft",
        search: "acme",
      })
    ).toBe(false);

    expect(
      invoiceMatchesListFilters(eurMissing, {
        needsExchangeRate: true,
        status: "sent",
        search: "zzz",
      })
    ).toBe(false);
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

  it("emits needsExchangeRate=1 when set, and omits it otherwise (AC2.5)", () => {
    expect(
      buildInvoiceListQueryString({ limit: 25, needsExchangeRate: true }),
    ).toContain("needsExchangeRate=1");

    expect(
      buildInvoiceListQueryString({ limit: 25, needsExchangeRate: false }),
    ).not.toContain("needsExchangeRate");

    expect(buildInvoiceListQueryString({ limit: 25 })).not.toContain("needsExchangeRate");
  });
});
