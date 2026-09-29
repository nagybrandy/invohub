// lib/receipts/report-date.test.ts
import { receiptReportDate } from "@/lib/receipts/report-date";

describe("receiptReportDate — the Budapest day a receipt is reported under", () => {
  it("is the same calendar day for a daytime receipt", () => {
    expect(receiptReportDate("2026-06-15T10:00:00.000Z")).toBe("2026-06-15");
  });

  it("is the NEW day for a receipt issued just after local midnight (22:30 UTC in summer)", () => {
    expect(receiptReportDate("2026-06-15T22:30:00.000Z")).toBe("2026-06-16");
  });

  it("follows winter time too (23:30 UTC = 00:30 CET)", () => {
    expect(receiptReportDate("2026-01-10T23:30:00.000Z")).toBe("2026-01-11");
    expect(receiptReportDate("2026-01-10T22:30:00.000Z")).toBe("2026-01-10");
  });

  it("accepts a Date", () => {
    expect(receiptReportDate(new Date("2026-06-15T10:00:00.000Z"))).toBe("2026-06-15");
  });
});
