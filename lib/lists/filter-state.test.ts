import { activeFilterCount, buildPeriodOptions } from "@/lib/lists/filter-state";
import { DEFAULT_INVOICE_SORT } from "@/lib/lists/invoice-sort";

describe("activeFilterCount", () => {
  const base = { filter: "all" as const, navFailed: false, month: undefined, sort: DEFAULT_INVOICE_SORT };

  it("is 0 for the default view", () => {
    expect(activeFilterCount(base)).toBe(0);
  });
  it("counts a status, or the NAV-failed filter, once", () => {
    expect(activeFilterCount({ ...base, filter: "overdue" })).toBe(1);
    expect(activeFilterCount({ ...base, navFailed: true })).toBe(1);
  });
  it("counts the period and a non-default sort", () => {
    expect(activeFilterCount({ ...base, month: "2026-10" })).toBe(1);
    expect(activeFilterCount({ ...base, sort: { key: "gross", direction: "desc" } })).toBe(1);
    expect(activeFilterCount({ ...base, sort: { key: "issued", direction: "asc" } })).toBe(1);
    expect(activeFilterCount({ filter: "paid", navFailed: false, month: "2026-10", sort: { key: "due", direction: "asc" } })).toBe(3);
  });
});

describe("buildPeriodOptions", () => {
  it("starts with the all-time option and lists months newest first", () => {
    const options = buildPeriodOptions({ allLabel: "All", language: "en", now: new Date("2026-11-03T10:00:00Z"), months: 3 });
    expect(options.map((o) => o.value)).toEqual(["", "2026-11", "2026-10", "2026-09"]);
    expect(options[0].label).toBe("All");
    expect(options[1].label).toBe("November 2026");
  });
  it("keeps a selected month outside the window selectable", () => {
    const options = buildPeriodOptions({
      allLabel: "All",
      language: "hu",
      now: new Date("2026-11-03T10:00:00Z"),
      months: 2,
      selected: "2020-01",
    });
    expect(options.map((o) => o.value)).toContain("2020-01");
  });
});
