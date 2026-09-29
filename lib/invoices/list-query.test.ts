// lib/invoices/list-query.test.ts
import {
  buildInvoiceListQueryString,
  invoiceMatchesListFilters,
  normalizeInvoiceListFilters,
  monthIssueDateRange,
  formatMonthLabel,
  shiftMonth,
  currentMonth,
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

describe("month filter — a list that can stay on one month", () => {
  it("normalizes a valid YYYY-MM and drops anything else", () => {
    expect(normalizeInvoiceListFilters({ month: "2026-09" }).month).toBe("2026-09");
    expect(normalizeInvoiceListFilters({ month: "2026-13" }).month).toBeUndefined();
    expect(normalizeInvoiceListFilters({ month: "2026-9" }).month).toBeUndefined();
    expect(normalizeInvoiceListFilters({ month: "" }).month).toBeUndefined();
    expect(normalizeInvoiceListFilters({}).month).toBeUndefined();
  });

  it("matches an invoice by the month of its issue date", () => {
    const base = { status: "unpaid", clientName: "A", invoiceNumber: "INV-1", clientTaxNumber: "", currency: "HUF", exchangeRate: undefined } as const;
    expect(invoiceMatchesListFilters({ ...base, issueDate: "2026-09-15" }, { month: "2026-09" })).toBe(true);
    expect(invoiceMatchesListFilters({ ...base, issueDate: "2026-08-31" }, { month: "2026-09" })).toBe(false);
    expect(invoiceMatchesListFilters({ ...base, issueDate: "2026-08-31" }, {})).toBe(true);
  });

  it("puts month on the query string only when set", () => {
    expect(buildInvoiceListQueryString({ limit: 30, month: "2026-09" })).toContain("month=2026-09");
    expect(buildInvoiceListQueryString({ limit: 30 })).not.toContain("month");
  });

  it("turns a month into the half-open issue-date range the SQL needs", () => {
    expect(monthIssueDateRange("2026-09")).toEqual({ start: "2026-09-01", end: "2026-10-01" });
    expect(monthIssueDateRange("2026-12")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });

  it("labels a month in the user's language", () => {
    expect(formatMonthLabel("2026-09", "hu")).toBe("2026. szeptember");
    expect(formatMonthLabel("2026-09", "en")).toBe("September 2026");
  });

  it("steps months and knows the current one", () => {
    expect(shiftMonth("2026-09", -1)).toBe("2026-08");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(currentMonth(new Date("2026-09-28T10:00:00Z"))).toBe("2026-09");
  });
});

describe("navFailed filter — a NAV outcome, not a status", () => {
  it("normalizes navFailed=1/true and nothing else", () => {
    expect(normalizeInvoiceListFilters({ navFailed: "1" }).navFailed).toBe(true);
    expect(normalizeInvoiceListFilters({ navFailed: "true" }).navFailed).toBe(true);
    expect(normalizeInvoiceListFilters({ navFailed: "0" }).navFailed).toBeUndefined();
    expect(normalizeInvoiceListFilters({}).navFailed).toBeUndefined();
  });

  it("emits navFailed=1 in the query string only when set", () => {
    expect(buildInvoiceListQueryString({ limit: 30, navFailed: true })).toContain("navFailed=1");
    expect(buildInvoiceListQueryString({ limit: 30 })).not.toContain("navFailed");
  });

  it("matches only invoices whose attached navStatus is failed", () => {
    const base = { status: "sent" as const, clientName: "A", invoiceNumber: "INV-1", clientTaxNumber: "", currency: "HUF" as const, exchangeRate: undefined, issueDate: "2026-09-01" };
    expect(invoiceMatchesListFilters({ ...base, navStatus: "failed" }, { navFailed: true })).toBe(true);
    expect(invoiceMatchesListFilters({ ...base, navStatus: "done" }, { navFailed: true })).toBe(false);
    expect(invoiceMatchesListFilters({ ...base }, { navFailed: true })).toBe(false);
  });
});

describe("needsExchangeRate — issued documents only", () => {
  const eur = { status: "sent" as const, clientName: "A", invoiceNumber: "INV-1", clientTaxNumber: "", currency: "EUR" as const, exchangeRate: undefined, issueDate: "2026-09-01" };

  it("matches an issued EUR invoice with no rate", () => {
    expect(invoiceMatchesListFilters({ ...eur, documentType: "invoice" }, { needsExchangeRate: true })).toBe(true);
  });

  it("does not match a draft or a díjbekérő — they get their rate at finalize time or never need one", () => {
    expect(invoiceMatchesListFilters({ ...eur, status: "draft", invoiceNumber: "" }, { needsExchangeRate: true })).toBe(false);
    expect(invoiceMatchesListFilters({ ...eur, status: "proforma", documentType: "proforma" }, { needsExchangeRate: true })).toBe(false);
    expect(invoiceMatchesListFilters({ ...eur, documentType: "proforma" }, { needsExchangeRate: true })).toBe(false);
  });
});
