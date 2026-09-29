// lib/receipts/daily-report.ts
// Groups a day's receipts into per-currency NAV eRECEIPT CreateReceiptRequest
// reports. HUF groups become a report; non-HUF groups are refused (blocked)
// because InvoHub stores no exchange rate on a receipt — see
// docs/plans/2026-09-18-e-nyugta-nav-receipt-api.md §1.3.
import type { DailyReceiptReport, ReceiptVatCategoryItem } from "@/lib/nav-receipt/types";
import { toNavVatCategory, type NavVatCategory } from "@/lib/nav-receipt/vat-category";
import type { NavReceiptBlockedReason } from "@/lib/receipts/nav-error-code";

export type DailyReportReceiptInput = {
  receiptNumber: string;
  currency: string;
  lineItems: { vatRate: number; quantity: number; unitPrice: number }[];
};

export type BuildDailyReceiptReportsOptions = {
  taxPayerId: string;
  issuingSoftwareName: string;
  /** yyyy-MM-dd */
  applicableDate: string;
  vatExempt?: boolean;
};

export type BlockedReceiptGroup = {
  currency: string;
  reason: NavReceiptBlockedReason;
  receiptCount: number;
};

export type BuildDailyReceiptReportsResult = {
  reports: DailyReceiptReport[];
  blocked: BlockedReceiptGroup[];
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function buildDailyReceiptReports(
  receipts: DailyReportReceiptInput[],
  opts: BuildDailyReceiptReportsOptions
): BuildDailyReceiptReportsResult {
  const byCurrency = new Map<string, DailyReportReceiptInput[]>();
  for (const r of receipts) {
    const list = byCurrency.get(r.currency) ?? [];
    list.push(r);
    byCurrency.set(r.currency, list);
  }

  const reports: DailyReceiptReport[] = [];
  const blocked: BlockedReceiptGroup[] = [];

  for (const [currency, group] of byCurrency) {
    if (currency !== "HUF") {
      blocked.push({ currency, reason: "missing_exchange_rate", receiptCount: group.length });
      continue;
    }

    const categoryTotals = new Map<NavVatCategory, number>();
    for (const receipt of group) {
      for (const item of receipt.lineItems) {
        const gross = item.quantity * item.unitPrice * (1 + item.vatRate / 100);
        const category = toNavVatCategory(item.vatRate, { vatExempt: opts.vatExempt });
        categoryTotals.set(category, round2((categoryTotals.get(category) ?? 0) + gross));
      }
    }

    const vatCategoryItems: ReceiptVatCategoryItem[] = Array.from(categoryTotals.entries()).map(
      ([vat, saleDocument]) => ({ vat, saleDocument, modifyingDocument: 0 })
    );

    const total = round2(
      vatCategoryItems.reduce((sum, item) => sum + item.saleDocument + item.modifyingDocument, 0)
    );

    const serialNumber = [...group].sort((a, b) => a.receiptNumber.localeCompare(b.receiptNumber))[0]
      .receiptNumber;

    reports.push({
      taxPayerId: opts.taxPayerId,
      issuingSoftwareName: opts.issuingSoftwareName,
      applicableDate: opts.applicableDate,
      serialNumber,
      currency,
      exchangeRate: null,
      vatCategoryItems,
      total,
      numberOfSaleDocument: group.length,
      numberOfModifyingDocument: 0,
    });
  }

  return { reports, blocked };
}
