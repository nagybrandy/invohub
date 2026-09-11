// lib/invoices/filter-invoices.test.ts
// Invoice list filter behavior.
import { makeInvoice } from "@/__tests__/fixtures/invoices";
import {
  filterInvoicesByStatus,
  invoiceStatusFilterI18nKey,
  INVOICE_STATUS_FILTERS,
} from "@/lib/invoices/filter-invoices";

describe("filterInvoicesByStatus", () => {
  const invoices = [
    makeInvoice({ id: "1", status: "draft" }),
    makeInvoice({ id: "2", status: "sent" }),
    makeInvoice({ id: "3", status: "paid" }),
    makeInvoice({ id: "4", status: "overdue" }),
    makeInvoice({ id: "5", status: "proforma" }),
    makeInvoice({ id: "6", status: "cancelled" }),
  ];

  it("returns all invoices for the all filter", () => {
    expect(filterInvoicesByStatus(invoices, "all")).toHaveLength(6);
  });

  it.each([
    ["draft", 1],
    ["sent", 1],
    ["paid", 1],
    ["overdue", 1],
    ["proforma", 1],
    ["cancelled", 1],
  ] as const)("filters by status %s", (status, count) => {
    const result = filterInvoicesByStatus(invoices, status);
    expect(result).toHaveLength(count);
    expect(result.every((inv) => inv.status === status)).toBe(true);
  });

  it("exposes every status chip including all", () => {
    expect(INVOICE_STATUS_FILTERS).toEqual([
      "all",
      "draft",
      "proforma",
      "sent",
      "paid",
      "overdue",
      "cancelled",
    ]);
  });
});

describe("invoiceStatusFilterI18nKey", () => {
  it("maps all to filters.all", () => {
    expect(invoiceStatusFilterI18nKey("all")).toBe("invoices.filters.all");
  });

  it("maps each status to invoices.status.*", () => {
    expect(invoiceStatusFilterI18nKey("paid")).toBe("invoices.status.paid");
    expect(invoiceStatusFilterI18nKey("overdue")).toBe(
      "invoices.status.overdue"
    );
    expect(invoiceStatusFilterI18nKey("proforma")).toBe(
      "invoices.status.proforma"
    );
  });
});
