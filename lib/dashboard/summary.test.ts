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
        paidAt: "2026-09-01T00:00:00.000Z",
        issueDate: "2026-09-01",
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

  it("counts a partially-paid invoice past its due date as overdue, even though its stored status stays partially_paid", () => {
    // The reminders cron deliberately never flips a partially_paid
    // invoice's status to "overdue" (lib/reminders/process.ts) — it would
    // discard the partial-payment signal — so the dashboard must derive
    // "overdue" from the due date for this one status instead of trusting
    // the stored status alone.
    const invoices = [
      makeInvoice({
        id: "partial-overdue",
        status: "partially_paid",
        dueDate: "2026-09-01",
        paidAmount: 10_000,
        createdAt: "2026-08-20T00:00:00.000Z",
        lineItems: [makeLineItem({ quantity: 1, unitPrice: 20_000, vatRate: 27 })],
      }),
      makeInvoice({
        id: "partial-not-due-yet",
        status: "partially_paid",
        dueDate: "2026-12-01",
        paidAmount: 10_000,
        createdAt: "2026-08-21T00:00:00.000Z",
        lineItems: [makeLineItem({ quantity: 1, unitPrice: 20_000, vatRate: 27 })],
      }),
    ];

    const summary = computeDashboardSummary(invoices, now);

    expect(summary.overdueTotal).toBe(25_400);
    expect(summary.overdueCount).toBe(1);
    expect(summary.oldestOverdueDays).toBe(11);
    // Still counted once in "outstanding" regardless of overdue-ness —
    // unaffected by this fix.
    expect(summary.outstanding).toBe(50_800);
  });

  it("sums VAT from the line items instead of a flat 27% guess", () => {
    const invoices = [
      makeInvoice({
        id: "mixed-vat",
        status: "paid",
        paidAt: "2026-09-05T00:00:00.000Z",
        issueDate: "2026-09-05",
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

    expect(totals.outstanding).toBe(88_900);
    expect(totals.overdueTotal).toBe(25_400);
    expect(totals.issuedTotal).toBe(12_700);
    // revenue and estimatedVat are period-bounded, so a GROUP BY status
    // cannot produce them — getDashboardSummaryFromDb queries them separately.
    expect(totals).not.toHaveProperty("revenue");
    expect(totals).not.toHaveProperty("estimatedVat");
  });

  it("returns zeros for an empty result set", () => {
    expect(aggregateStatusTotals([])).toEqual({
      paidTotal: 0,
      outstanding: 0,
      overdueTotal: 0,
      issuedTotal: 0,
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
      // revenue: gross of what was PAID this calendar month
      {
        from: () => ({
          leftJoin: () => ({
            where: () => Promise.resolve([{ gross: "127000", count: "1" }]),
          }),
        }),
      },
      // estimated VAT: VAT of documents ISSUED this quarter
      {
        from: () => ({
          leftJoin: () => ({
            where: () => Promise.resolve([{ vat: "81000" }]),
          }),
        }),
      },
      // overdue rows (status "overdue", or "partially_paid" past due date)
      {
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              groupBy: () =>
                Promise.resolve([
                  { dueDate: "2026-09-01", net: "20000", vat: "5400" },
                ]),
            }),
          }),
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

    // latest NAV submission per invoice (loadLatestNavStatusForUser):
    // inv-recent failed, some other invoice is fine
    chains.push({
      from: () => ({
        leftJoin: () => ({
          where: () =>
            Promise.resolve([
              { invoiceId: "inv-recent", status: "error", createdAt: "2026-09-10T12:00:00.000Z" },
              { invoiceId: "inv-other", status: "done", createdAt: "2026-09-09T12:00:00.000Z" },
            ]),
        }),
      }),
    });
    let call = 0;
    mockDb.select.mockImplementation(() => chains[call++]);

    const summary = await getDashboardSummaryFromDb("user-1", now);

    expect(summary.revenue).toBe(127_000);
    expect(summary.revenuePaidCount).toBe(1);
    // the period KPIs come from their own filtered queries, not the status fold
    expect(summary.estimatedVat).toBe(81_000);
    expect(summary.overdueTotal).toBe(25_400);
    expect(summary.overdueCount).toBe(1);
    expect(summary.oldestOverdueDays).toBe(11);
    expect(summary.recentInvoices).toHaveLength(1);
    expect(summary.recentInvoices[0].invoiceNumber).toBe("INV-2026-009");
    // the recent row carries its latest NAV outcome, and the failure is counted
    expect(summary.recentInvoices[0].navStatus).toBe("failed");
    expect(summary.navFailedCount).toBe(1);
    // status fold, revenue, VAT, overdue, recent invoices, recent line items, latest NAV.
    expect(mockDb.select).toHaveBeenCalledTimes(7);
  });
});

describe("computeDashboardSummary — the period KPIs must mean what their labels say", () => {
  const now = new Date("2026-09-12T12:00:00.000Z"); // Q3

  const paidOn = (id: string, paidAt: string, unitPrice: number) =>
    makeInvoice({
      id,
      status: "paid",
      paidAt,
      issueDate: paidAt.slice(0, 10),
      createdAt: paidAt,
      lineItems: [makeLineItem({ quantity: 1, unitPrice, vatRate: 27 })],
    });

  it('counts only this month in "E havi bevétel", not every invoice ever paid', () => {
    const summary = computeDashboardSummary(
      [
        paidOn("this-month", "2026-09-03T00:00:00.000Z", 100_000),
        paidOn("last-month", "2026-08-28T00:00:00.000Z", 500_000),
        paidOn("last-year", "2025-09-03T00:00:00.000Z", 900_000),
      ],
      now,
    );

    expect(summary.revenue).toBe(127_000);
  });

  it("leaves a paid invoice with no payment date out of the month rather than inflating it", () => {
    const noDate = makeInvoice({
      id: "legacy",
      status: "paid",
      paidAt: undefined,
      lineItems: [makeLineItem({ quantity: 1, unitPrice: 400_000, vatRate: 27 })],
    });

    expect(computeDashboardSummary([noDate], now).revenue).toBe(0);
  });

  it("estimates VAT from documents issued in the current quarter, the basis the hint claims", () => {
    const issued = (id: string, issueDate: string, unitPrice: number, extra = {}) =>
      makeInvoice({
        id,
        status: "unpaid",
        issueDate,
        createdAt: `${issueDate}T00:00:00.000Z`,
        lineItems: [makeLineItem({ quantity: 1, unitPrice, vatRate: 27 })],
        ...extra,
      });

    const summary = computeDashboardSummary(
      [
        issued("q3-unpaid", "2026-07-05", 100_000),
        issued("q3-paid", "2026-08-11", 200_000, { status: "paid", paidAt: "2026-08-12T00:00:00.000Z" }),
        issued("q2", "2026-06-30", 800_000),
        issued("q3-draft", "2026-09-01", 400_000, { status: "draft" }),
        issued("q3-proforma", "2026-09-02", 400_000, { status: "proforma", documentType: "proforma" }),
      ],
      now,
    );

    // 27% of 300 000 — the unpaid one counts (liability follows issuance),
    // the draft and the díjbekérő never do.
    expect(summary.estimatedVat).toBe(81_000);
  });

  it("nets a storno against the invoice it cancels, instead of double-counting either", () => {
    const original = makeInvoice({
      id: "orig",
      status: "cancelled",
      issueDate: "2026-08-01",
      lineItems: [makeLineItem({ quantity: 1, unitPrice: 100_000, vatRate: 27 })],
    });
    const storno = makeInvoice({
      id: "storno",
      status: "sent",
      documentType: "storno",
      issueDate: "2026-08-02",
      originalInvoiceId: "orig",
      lineItems: [makeLineItem({ quantity: -1, unitPrice: 100_000, vatRate: 27 })],
    });

    expect(computeDashboardSummary([original, storno], now).estimatedVat).toBe(0);
  });
});

describe("computeDashboardSummary — the revenue bar needs an all-time paid figure", () => {
  const now = new Date("2026-09-12T12:00:00.000Z");

  it("exposes paidTotal as all-time paid gross, separate from the month-bounded revenue", () => {
    // The "Bevétel statisztika" bar compares collected vs outstanding over
    // everything ever invoiced. Feeding it the month-bounded `revenue` next
    // to the all-time `outstanding` compared a month to all time.
    const summary = computeDashboardSummary(
      [
        makeInvoice({ id: "p-now", status: "paid", paidAt: "2026-09-03T00:00:00.000Z", issueDate: "2026-09-03", lineItems: [makeLineItem({ quantity: 1, unitPrice: 100_000, vatRate: 27 })] }),
        makeInvoice({ id: "p-old", status: "paid", paidAt: "2025-01-10T00:00:00.000Z", issueDate: "2025-01-10", lineItems: [makeLineItem({ quantity: 1, unitPrice: 100_000, vatRate: 27 })] }),
        makeInvoice({ id: "open", status: "sent", issueDate: "2026-09-04", lineItems: [makeLineItem({ quantity: 1, unitPrice: 50_000, vatRate: 27 })] }),
      ],
      now,
    );

    expect(summary.revenue).toBe(127_000);
    expect(summary.paidTotal).toBe(254_000);
    expect(summary.outstanding).toBe(63_500);
  });
});
