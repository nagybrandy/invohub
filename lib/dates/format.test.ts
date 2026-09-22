// lib/dates/format.test.ts
import {
  formatShortDate,
  formatDateOnly,
  formatDateWithTime,
  formatInvoiceIssueDateTime,
} from "@/lib/dates/format";

describe("formatDateWithTime", () => {
  it("appends hour and minute after the date", () => {
    const formatted = formatDateWithTime(
      "2026-07-05",
      "2026-07-05T09:36:00.000Z"
    );
    expect(formatted).toMatch(/2026\. 07\. 05\./);
    expect(formatted).toMatch(/\d{2}:\d{2}$/);
  });

  it("uses timestamp embedded in the same value when no time source is passed", () => {
    const formatted = formatDateWithTime("2026-07-05T14:30:00.000Z");
    expect(formatted).toMatch(/2026\. 07\. 05\./);
    expect(formatted).toMatch(/\d{2}:\d{2}$/);
  });
});

describe("formatDateOnly", () => {
  it("formats YYYY-MM-DD without time", () => {
    expect(formatDateOnly("2026-07-05")).toBe("2026. 07. 05.");
  });
});

describe("formatInvoiceIssueDateTime", () => {
  it("combines issue date with createdAt time", () => {
    const formatted = formatInvoiceIssueDateTime({
      issueDate: "2026-07-05",
      createdAt: "2026-07-05T11:29:00.000Z",
    });
    expect(formatted).toMatch(/2026\. 07\. 05\./);
    expect(formatted).toMatch(/\d{2}:\d{2}$/);
  });
});

describe("formatShortDate", () => {
  const now = new Date("2026-09-22T10:00:00Z");
  it("drops the year for dates in the current year", () => {
    expect(formatShortDate("2026-09-30", now)).toBe("szept. 30.");
  });
  it("keeps the year for other years", () => {
    expect(formatShortDate("2025-12-31", now)).toBe("2025. dec. 31.");
  });
  it("returns unparseable input unchanged", () => {
    expect(formatShortDate("n/a", now)).toBe("n/a");
  });
});
