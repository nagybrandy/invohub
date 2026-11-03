// lib/dashboard/period-labels.test.ts
import { formatAsOfDate, formatMonthLabel } from "@/lib/dashboard/period-labels";

describe("formatMonthLabel", () => {
  const date = new Date(2026, 10, 3, 12);

  it("names the year and month in Hungarian", () => {
    expect(formatMonthLabel(date, "hu")).toMatch(/^2026\. [Nn]ovember$/);
  });

  it("names the month and year in English", () => {
    expect(formatMonthLabel(date, "en")).toBe("November 2026");
  });
});

describe("formatAsOfDate", () => {
  it("formats the day for the locale", () => {
    expect(formatAsOfDate(new Date(2026, 10, 3, 12), "hu")).toContain("2026");
    expect(formatAsOfDate(new Date(2026, 10, 3, 12), "en")).toBe("03/11/2026");
  });
});
