// lib/exchange-rates/rate-window.test.ts
import {
  MNB_LOOKUP_WINDOW_DAYS,
  addDaysIso,
  buildLookupWindow,
  pickLatestRateOnOrBefore,
  resolveInvoiceRateDate,
} from "@/lib/exchange-rates/rate-window";
import type { MnbRate } from "@/lib/exchange-rates/mnb";

describe("addDaysIso", () => {
  it("adds positive days", () => {
    expect(addDaysIso("2026-09-22", 3)).toBe("2026-09-25");
  });

  it("subtracts with a negative count", () => {
    expect(addDaysIso("2026-09-22", -10)).toBe("2026-09-12");
  });

  it("crosses a month/year boundary", () => {
    expect(addDaysIso("2026-01-03", -10)).toBe("2025-12-24");
  });
});

describe("buildLookupWindow", () => {
  it("spans MNB_LOOKUP_WINDOW_DAYS days ending on the target date", () => {
    expect(buildLookupWindow("2026-09-22")).toEqual({
      startDate: "2026-09-12",
      endDate: "2026-09-22",
    });
  });

  it("honours a custom window size", () => {
    expect(buildLookupWindow("2026-09-22", 3)).toEqual({
      startDate: "2026-09-19",
      endDate: "2026-09-22",
    });
  });

  it("defaults to a 10-day window", () => {
    expect(MNB_LOOKUP_WINDOW_DAYS).toBe(10);
  });
});

describe("resolveInvoiceRateDate", () => {
  it("prefers the fulfillment date when present", () => {
    expect(resolveInvoiceRateDate("2026-09-01", "2026-09-05")).toBe("2026-09-05");
  });

  it("falls back to the issue date when fulfillment date is absent", () => {
    expect(resolveInvoiceRateDate("2026-09-01", undefined)).toBe("2026-09-01");
  });

  it("falls back to the issue date when fulfillment date is blank", () => {
    expect(resolveInvoiceRateDate("2026-09-01", "  ")).toBe("2026-09-01");
  });
});

describe("pickLatestRateOnOrBefore", () => {
  const rates: MnbRate[] = [
    { date: "2026-09-18", currency: "EUR", unit: 1, rate: 395.12 },
    { date: "2026-09-21", currency: "EUR", unit: 1, rate: 396.8 },
    { date: "2026-09-18", currency: "JPY", unit: 100, rate: 265.43 },
  ];

  it("picks the exact date when it's present (a normal business day)", () => {
    expect(pickLatestRateOnOrBefore(rates, "EUR", "2026-09-21")).toEqual({
      date: "2026-09-21",
      currency: "EUR",
      unit: 1,
      rate: 396.8,
    });
  });

  it("falls back to the latest earlier day when the target date has no quote (weekend/holiday)", () => {
    // 2026-09-22 (Tuesday) has no quote in the fixture — MNB publishes the
    // next business day's own rate later, so 09-21 is the correct fallback.
    expect(pickLatestRateOnOrBefore(rates, "EUR", "2026-09-22")).toEqual({
      date: "2026-09-21",
      currency: "EUR",
      unit: 1,
      rate: 396.8,
    });
  });

  it("never returns a rate published after the target date", () => {
    expect(pickLatestRateOnOrBefore(rates, "EUR", "2026-09-19")).toEqual({
      date: "2026-09-18",
      currency: "EUR",
      unit: 1,
      rate: 395.12,
    });
  });

  it("filters by currency", () => {
    expect(pickLatestRateOnOrBefore(rates, "JPY", "2026-09-22")).toEqual({
      date: "2026-09-18",
      currency: "JPY",
      unit: 100,
      rate: 265.43,
    });
  });

  it("returns null when nothing qualifies", () => {
    expect(pickLatestRateOnOrBefore(rates, "USD", "2026-09-22")).toBeNull();
    expect(pickLatestRateOnOrBefore(rates, "EUR", "2026-09-01")).toBeNull();
  });
});
