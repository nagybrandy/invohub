// lib/receipts/daily-report.test.ts
import { buildDailyReceiptReports } from "@/lib/receipts/daily-report";
import type { DailyReportReceiptInput } from "@/lib/receipts/daily-report";

function receipt(
  receiptNumber: string,
  currency: string,
  lineItems: { vatRate: number; quantity: number; unitPrice: number }[]
): DailyReportReceiptInput {
  return { receiptNumber, currency, lineItems };
}

const baseOpts = {
  taxPayerId: "12345678",
  issuingSoftwareName: "InvoHub",
  applicableDate: "2026-09-01",
};

describe("buildDailyReceiptReports", () => {
  it("returns empty reports and blocked for an empty day", () => {
    const result = buildDailyReceiptReports([], baseOpts);
    expect(result).toEqual({ reports: [], blocked: [] });
  });

  it("groups a mixed-rate HUF day into gross sums per NAV category", () => {
    const receipts: DailyReportReceiptInput[] = [
      receipt("NYG-2026-002", "HUF", [{ vatRate: 27, quantity: 1, unitPrice: 1000 }]),
      receipt("NYG-2026-001", "HUF", [
        { vatRate: 27, quantity: 1, unitPrice: 1000 },
        { vatRate: 5, quantity: 2, unitPrice: 500 },
      ]),
    ];

    const { reports, blocked } = buildDailyReceiptReports(receipts, baseOpts);

    expect(blocked).toEqual([]);
    expect(reports).toHaveLength(1);
    const report = reports[0];
    expect(report.currency).toBe("HUF");
    expect(report.exchangeRate).toBeNull();
    expect(report.numberOfSaleDocument).toBe(2);
    expect(report.numberOfModifyingDocument).toBe(0);
    // Lowest receipt number in the group.
    expect(report.serialNumber).toBe("NYG-2026-001");

    const rate27 = report.vatCategoryItems.find((c) => c.vat === "27%");
    const rate5 = report.vatCategoryItems.find((c) => c.vat === "5%");
    expect(rate27?.saleDocument).toBeCloseTo(2540, 2); // 2 x (1000 * 1.27)
    expect(rate5?.saleDocument).toBeCloseTo(1050, 2); // 2 * 500 * 1.05
    expect(report.total).toBeCloseTo(3590, 2);
  });

  it("maps every line to the AAM category for an AAM (vatExempt) company", () => {
    const receipts: DailyReportReceiptInput[] = [
      receipt("NYG-1", "HUF", [{ vatRate: 0, quantity: 1, unitPrice: 1000 }]),
    ];
    const { reports } = buildDailyReceiptReports(receipts, { ...baseOpts, vatExempt: true });
    expect(reports[0].vatCategoryItems).toHaveLength(1);
    expect(reports[0].vatCategoryItems[0].vat).toBe("Alanyi adómentes");
  });

  it("splits a HUF+EUR day into one HUF report and one blocked EUR group", () => {
    const receipts: DailyReportReceiptInput[] = [
      receipt("NYG-1", "HUF", [{ vatRate: 27, quantity: 1, unitPrice: 1000 }]),
      receipt("NYG-2", "EUR", [{ vatRate: 27, quantity: 1, unitPrice: 10 }]),
    ];
    const { reports, blocked } = buildDailyReceiptReports(receipts, baseOpts);

    expect(reports).toHaveLength(1);
    expect(reports[0].currency).toBe("HUF");
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toEqual({ currency: "EUR", reason: "missing_exchange_rate", receiptCount: 1 });
  });

  it("produces no report for a currency group with only non-HUF receipts", () => {
    const receipts: DailyReportReceiptInput[] = [
      receipt("NYG-1", "EUR", [{ vatRate: 27, quantity: 1, unitPrice: 10 }]),
    ];
    const { reports, blocked } = buildDailyReceiptReports(receipts, baseOpts);
    expect(reports).toEqual([]);
    expect(blocked).toEqual([{ currency: "EUR", reason: "missing_exchange_rate", receiptCount: 1 }]);
  });

  it("never produces a report with both count fields 0", () => {
    const receipts: DailyReportReceiptInput[] = [
      receipt("NYG-1", "HUF", [{ vatRate: 27, quantity: 1, unitPrice: 1000 }]),
    ];
    const { reports } = buildDailyReceiptReports(receipts, baseOpts);
    for (const report of reports) {
      expect(report.numberOfSaleDocument === 0 && report.numberOfModifyingDocument === 0).toBe(false);
    }
  });

  it("rounds every amount to 2 decimals", () => {
    const receipts: DailyReportReceiptInput[] = [
      receipt("NYG-1", "HUF", [{ vatRate: 27, quantity: 3, unitPrice: 333.333 }]),
    ];
    const { reports } = buildDailyReceiptReports(receipts, baseOpts);
    const category = reports[0].vatCategoryItems[0];
    expect(Number.isInteger(category.saleDocument * 100)).toBe(true);
    expect(Number.isInteger(reports[0].total * 100)).toBe(true);
  });
});
