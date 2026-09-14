// lib/dashboard/summary.test.ts
jest.mock("@/db", () => ({
  db: { select: jest.fn() },
}));

import { db } from "@/db";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";
import {
  aggregateStatusTotals,
  computeDashboardSummary,
  getDashboardSummaryFromDb,
} from "@/lib/dashboard/summary";

const mockDb = db as unknown as { select: jest.Mock };

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

describe("aggregateStatusTotals", () => {
  it("buckets paid/outstanding/overdue/issued from grouped SQL rows", () => {
    const totals = aggregateStatusTotals([
      { status: "paid", net: 100_000, vat: 27_000 },
      { status: "sent", net: 50_000, vat: 13_500 },
      { status: "overdue", net: 20_000, vat: 5_400 },
      { status: "draft", net: 10_000, vat: 2_700 },
      { status: "cancelled", net: 999, vat: 0 },
    ]);

    expect(totals.revenue).toBe(127_000);
    expect(totals.outstanding).toBe(88_900);
    expect(totals.overdueTotal).toBe(25_400);
    expect(totals.issuedTotal).toBe(12_700);
    expect(totals.estimatedVat).toBe(27_000);
  });

  it("returns zeros for an empty result set", () => {
    expect(aggregateStatusTotals([])).toEqual({
      revenue: 0,
      outstanding: 0,
      overdueTotal: 0,
      issuedTotal: 0,
      estimatedVat: 0,
    });
  });
});

describe("getDashboardSummaryFromDb", () => {
  const now = new Date("2026-09-12T12:00:00.000Z");

  beforeEach(() => {
    mockDb.select.mockClear();
  });

  it("aggregates status totals, overdue detail, and recent invoices from SQL, not a capped list", async () => {
    // Each db.select() call in getDashboardSummaryFromDb returns a differently
    // shaped chain, in call order: grouped totals, overdue due dates, recent
    // invoices, recent invoices' line items.
    const chains: unknown[] = [
      // grouped totals
      {
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              groupBy: () =>
                Promise.resolve([
                  { status: "paid", net: "100000", vat: "27000" },
                  { status: "overdue", net: "20000", vat: "5400" },
                ]),
            }),
          }),
        }),
      },
      // overdue due dates
      {
        from: () => ({
          where: () => Promise.resolve([{ dueDate: "2026-09-01" }]),
        }),
      },
      // recent invoices
      {
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () =>
                Promise.resolve([
                  {
                    id: "inv-recent",
                    userId: "user-1",
                    companyId: null,
                    clientId: null,
                    invoiceNumber: "INV-2026-009",
                    documentType: "invoice",
                    clientName: "Acme",
                    clientTaxNumber: null,
                    issueDate: "2026-09-10",
                    dueDate: "2026-09-20",
                    status: "sent",
                    currency: "HUF",
                    exchangeRate: null,
                    notes: null,
                    paymentMethod: null,
                    paidAt: null,
                    paidAmount: null,
                    originalInvoiceId: null,
                    modifiesInvoiceId: null,
                    modificationIndex: null,
                    createdAt: now,
                    updatedAt: now,
                  },
                ]),
            }),
          }),
        }),
      },
      // recent invoices' line items
      {
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      },
    ];

    let call = 0;
    mockDb.select.mockImplementation(() => chains[call++]);

    const summary = await getDashboardSummaryFromDb("user-1", now);

    expect(summary.revenue).toBe(127_000);
    expect(summary.overdueTotal).toBe(25_400);
    expect(summary.overdueCount).toBe(1);
    expect(summary.oldestOverdueDays).toBe(11);
    expect(summary.recentInvoices).toHaveLength(1);
    expect(summary.recentInvoices[0].invoiceNumber).toBe("INV-2026-009");
    // 3 select calls that don't need a per-invoice line-item join, + 1 for recent line items = 4.
    expect(mockDb.select).toHaveBeenCalledTimes(4);
  });
});
