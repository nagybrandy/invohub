// lib/dashboard/summary.test.ts
// Dashboard summary accuracy against invoice fixtures.
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";
import { computeDashboardSummary } from "@/lib/dashboard/summary";

const NOW = new Date("2026-06-20T12:00:00.000Z");

describe("computeDashboardSummary", () => {
  it("aggregates paid, issued, outstanding, overdue, and VAT from fixtures", () => {
    const paid = makeInvoice({
      id: "paid-1",
      status: "paid",
      createdAt: "2026-06-10T10:00:00.000Z",
      lineItems: [makeLineItem({ quantity: 1, unitPrice: 1000, vatRate: 27 })],
    });
    const draft = makeInvoice({
      id: "draft-1",
      status: "draft",
      createdAt: "2026-06-11T10:00:00.000Z",
      lineItems: [makeLineItem({ quantity: 1, unitPrice: 200, vatRate: 27 })],
    });
    const proforma = makeInvoice({
      id: "proforma-1",
      status: "proforma",
      createdAt: "2026-06-12T10:00:00.000Z",
      lineItems: [makeLineItem({ quantity: 1, unitPrice: 100, vatRate: 5 })],
    });
    const sent = makeInvoice({
      id: "sent-1",
      status: "sent",
      createdAt: "2026-06-13T10:00:00.000Z",
      lineItems: [makeLineItem({ quantity: 2, unitPrice: 50, vatRate: 27 })],
    });
    const overdue = makeInvoice({
      id: "overdue-1",
      status: "overdue",
      dueDate: "2026-06-01",
      createdAt: "2026-05-01T10:00:00.000Z",
      lineItems: [makeLineItem({ quantity: 1, unitPrice: 400, vatRate: 27 })],
    });
    const cancelled = makeInvoice({
      id: "cancelled-1",
      status: "cancelled",
      createdAt: "2026-06-14T10:00:00.000Z",
      lineItems: [makeLineItem({ quantity: 1, unitPrice: 9999, vatRate: 27 })],
    });

    const summary = computeDashboardSummary(
      [paid, draft, proforma, sent, overdue, cancelled],
      NOW
    );

    // paid: 1000 + 270 = 1270
    expect(summary.paid).toBe(1270);
    // issued (draft+proforma): 200*1.27 + 100*1.05 = 254 + 105 = 359
    expect(summary.issued).toBe(359);
    // outstanding (sent+overdue): 100*1.27 + 400*1.27 = 127 + 508 = 635
    expect(summary.outstanding).toBe(635);
    // overdue only
    expect(summary.overdue).toBe(508);
    expect(summary.overdueCount).toBe(1);
    expect(summary.oldestOverdueDays).toBe(19);
    // VAT estimate from paid line items only (not reverse-engineered 27%)
    expect(summary.estimatedVat).toBe(270);
    // cancelled excluded from all money totals
    expect(summary.recentInvoices.map((i) => i.id)).toEqual([
      "cancelled-1",
      "sent-1",
      "proforma-1",
      "draft-1",
      "paid-1",
    ]);
  });

  it("returns zeros for an empty invoice list", () => {
    const summary = computeDashboardSummary([], NOW);
    expect(summary).toMatchObject({
      paid: 0,
      issued: 0,
      outstanding: 0,
      overdue: 0,
      overdueCount: 0,
      oldestOverdueDays: 0,
      estimatedVat: 0,
    });
    expect(summary.recentInvoices).toEqual([]);
  });

  it("sums VAT across mixed rates on paid invoices only", () => {
    const paidMixed = makeInvoice({
      status: "paid",
      lineItems: [
        makeLineItem({ id: "a", quantity: 1, unitPrice: 100, vatRate: 27 }),
        makeLineItem({ id: "b", quantity: 1, unitPrice: 200, vatRate: 5 }),
      ],
    });
    const unpaid = makeInvoice({
      id: "sent",
      status: "sent",
      lineItems: [makeLineItem({ quantity: 1, unitPrice: 1000, vatRate: 27 })],
    });

    const summary = computeDashboardSummary([paidMixed, unpaid], NOW);
    expect(summary.estimatedVat).toBe(27 + 10);
    expect(summary.paid).toBe(100 * 1.27 + 200 * 1.05);
  });
});
