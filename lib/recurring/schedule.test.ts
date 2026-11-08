import {
  firstIndexOnOrAfter,
  isValidDateKey,
  occurrenceDate,
  resolveDue,
  validateSchedule,
  type RecurrenceSchedule,
} from "@/lib/recurring/schedule";

const monthly = (startDate: string, extra: Partial<RecurrenceSchedule> = {}): RecurrenceSchedule => ({
  frequency: "monthly",
  startDate,
  ...extra,
});

describe("occurrenceDate", () => {
  it("monthly from Jan 31 clamps to month end but re-anchors on the 31st", () => {
    const s = monthly("2027-01-31");
    expect([0, 1, 2, 3, 4].map((i) => occurrenceDate(s, i))).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
      "2027-04-30",
      "2027-05-31",
    ]);
  });

  it("uses Feb 29 in a leap year", () => {
    const s = monthly("2028-01-31");
    expect(occurrenceDate(s, 1)).toBe("2028-02-29");
    expect(occurrenceDate(s, 2)).toBe("2028-03-31");
  });

  it("quarterly steps three months and clamps", () => {
    const s: RecurrenceSchedule = { frequency: "quarterly", startDate: "2027-11-30" };
    expect([0, 1, 2, 3].map((i) => occurrenceDate(s, i))).toEqual([
      "2027-11-30",
      "2028-02-29",
      "2028-05-30",
      "2028-08-30",
    ]);
  });

  it("yearly from Feb 29 falls back to Feb 28 in non-leap years and returns on leap years", () => {
    const s: RecurrenceSchedule = { frequency: "yearly", startDate: "2028-02-29" };
    expect([0, 1, 2, 3, 4].map((i) => occurrenceDate(s, i))).toEqual([
      "2028-02-29",
      "2029-02-28",
      "2030-02-28",
      "2031-02-28",
      "2032-02-29",
    ]);
  });

  it("crosses year boundaries", () => {
    expect(occurrenceDate(monthly("2027-11-15"), 2)).toBe("2028-01-15");
  });

  it("endDate is inclusive", () => {
    const s = monthly("2027-01-15", { endDate: "2027-03-15" });
    expect(occurrenceDate(s, 2)).toBe("2027-03-15");
    expect(occurrenceDate(s, 3)).toBeNull();
  });

  it("endDate one day earlier excludes the occurrence", () => {
    const s = monthly("2027-01-15", { endDate: "2027-03-14" });
    expect(occurrenceDate(s, 2)).toBeNull();
  });

  it("maxOccurrences counts the first occurrence", () => {
    const s = monthly("2027-01-15", { maxOccurrences: 3 });
    expect(occurrenceDate(s, 2)).toBe("2027-03-15");
    expect(occurrenceDate(s, 3)).toBeNull();
  });

  it("both end conditions: the earlier one wins", () => {
    const s = monthly("2027-01-15", { maxOccurrences: 10, endDate: "2027-02-20" });
    expect(occurrenceDate(s, 1)).toBe("2027-02-15");
    expect(occurrenceDate(s, 2)).toBeNull();
  });

  it("rejects negative indexes", () => {
    expect(occurrenceDate(monthly("2027-01-15"), -1)).toBeNull();
  });
});

describe("firstIndexOnOrAfter", () => {
  it("returns 0 when start is in the future", () => {
    expect(firstIndexOnOrAfter(monthly("2027-05-10"), "2027-01-01")).toBe(0);
  });
  it("skips past occurrences", () => {
    expect(firstIndexOnOrAfter(monthly("2027-01-31"), "2027-02-28")).toBe(1);
    expect(firstIndexOnOrAfter(monthly("2027-01-31"), "2027-03-01")).toBe(2);
  });
  it("is fine for yearly with a long gap", () => {
    expect(firstIndexOnOrAfter({ frequency: "yearly", startDate: "2020-06-01" }, "2027-06-02")).toBe(8);
  });
});

describe("resolveDue (at most one period per run)", () => {
  it("is not due before the occurrence date", () => {
    expect(resolveDue(monthly("2027-01-31"), 0, "2027-01-30")).toEqual({
      state: "waiting",
      nextRunDate: "2027-01-31",
    });
  });

  it("is due on the occurrence date", () => {
    expect(resolveDue(monthly("2027-01-31"), 0, "2027-01-31")).toEqual({
      state: "due",
      index: 0,
      periodKey: "2027-01-31",
      periodDate: "2027-01-31",
    });
  });

  it("catch-up: returns only the OLDEST missed period", () => {
    const r = resolveDue(monthly("2027-01-15"), 0, "2027-04-20");
    expect(r).toMatchObject({ state: "due", index: 0, periodKey: "2027-01-15" });
  });

  it("completed once past end", () => {
    const s = monthly("2027-01-15", { maxOccurrences: 2 });
    expect(resolveDue(s, 2, "2027-09-01")).toEqual({ state: "completed" });
  });
});

describe("validateSchedule", () => {
  it("accepts a plain schedule", () => {
    expect(validateSchedule(monthly("2027-01-31"))).toEqual({ ok: true });
  });
  it("rejects bad frequency, dates and counts", () => {
    expect(validateSchedule({ frequency: "weekly" as never, startDate: "2027-01-01" }).ok).toBe(false);
    expect(validateSchedule(monthly("2027-02-30")).ok).toBe(false);
    expect(validateSchedule(monthly("2027-01-01", { endDate: "2026-12-31" })).ok).toBe(false);
    expect(validateSchedule(monthly("2027-01-01", { maxOccurrences: 0 })).ok).toBe(false);
    expect(validateSchedule(monthly("2027-01-01", { maxOccurrences: 1.5 })).ok).toBe(false);
    expect(validateSchedule(monthly("2027-01-01", { endDate: "nope" })).ok).toBe(false);
  });
});

describe("isValidDateKey", () => {
  it("checks real calendar dates", () => {
    expect(isValidDateKey("2028-02-29")).toBe(true);
    expect(isValidDateKey("2027-02-29")).toBe(false);
    expect(isValidDateKey("2027-2-1")).toBe(false);
  });
});
