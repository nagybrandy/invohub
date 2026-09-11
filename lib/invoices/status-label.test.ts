// lib/invoices/status-label.test.ts
import {
  invoiceStatusColorClass,
  invoiceStatusI18nKey,
} from "@/lib/invoices/status-label";
import type { InvoiceStatus } from "@/lib/invoices/types";

describe("invoiceStatusI18nKey", () => {
  it.each([
    ["draft", "invoices.status.draft"],
    ["proforma", "invoices.status.proforma"],
    ["sent", "invoices.status.sent"],
    ["paid", "invoices.status.paid"],
    ["overdue", "invoices.status.overdue"],
    ["cancelled", "invoices.status.cancelled"],
  ] as const)("maps %s", (status, key) => {
    expect(invoiceStatusI18nKey(status)).toBe(key);
  });
});

describe("invoiceStatusColorClass", () => {
  it("uses green only for paid", () => {
    const statuses: InvoiceStatus[] = [
      "draft",
      "proforma",
      "sent",
      "paid",
      "overdue",
      "cancelled",
    ];
    for (const status of statuses) {
      const cls = invoiceStatusColorClass(status);
      if (status === "paid") {
        expect(cls).toContain("green");
      } else {
        expect(cls).not.toContain("green");
      }
    }
  });

  it("uses primary (brand) for sent, not green", () => {
    expect(invoiceStatusColorClass("sent")).toContain("primary");
  });
});
