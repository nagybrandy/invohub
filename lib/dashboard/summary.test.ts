// lib/dashboard/summary.test.ts
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";
import { computeDashboardSummary } from "@/lib/dashboard/summary";

describe("computeDashboardSummary", () => {
  const now = new Date("2026-09-12T12:00:00.000Z");

  it("separates overdue totals from broader outstanding amounts", () => {
    const invoices = [
      makeInvoice({
        id: "paid",
        status: "paid",
        createdAt: "2026-09-01T00:00:00.000Z",
        lineItems: [makeLineItem({ quantity: 1, unitPrice: 100_000, vatRate: 27 })],
      }),
      makeInvoice({
        id: "sent",
        status: "sent",
        createdAt: "2026-09-02T00:00:00.000Z",
        lineItems: [makeLineItem({ quantity: 1, unitPrice: 50_000, vatRate: 27 })],
      }),
      makeInvoice({
        id: "overdue",
        status: "overdue",
        dueDate: "2026-09-01",
        createdAt: "2026-08-20T00:00:00.000Z",
        lineItems: [makeLineItem({ quantity: 1, unitPrice: 20_000, vatRate: 27 })],
      }),
    ];

    const summary = computeDashboardSummary(invoices, now);

    expect(summary.revenue).toBe(127_000);
    expect(summary.outstanding).toBe(88_900);
    expect(summary.overdueTotal).toBe(25_400);
    expect(summary.overdueCount).toBe(1);
    expect(summary.oldestOverdueDays).toBe(11);
  });

  it("sums VAT from paid invoice line items instead of a flat 27% guess", () => {
    const invoices = [
      makeInvoice({
        id: "mixed-vat",
        status: "paid",
        lineItems: [
          makeLineItem({ quantity: 1, unitPrice: 100_000, vatRate: 27 }),
          makeLineItem({ quantity: 1, unitPrice: 10_000, vatRate: 0 }),
        ],
      }),
    ];

    const summary = computeDashboardSummary(invoices, now);

    expect(summary.estimatedVat).toBe(27_000);
    expect(summary.revenue).toBe(137_000);
  });
});
