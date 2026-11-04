// lib/dashboard/todo-summary.test.ts
import { computeTodoSummary, splitOutstanding } from "@/lib/dashboard/todo-summary";

describe("computeTodoSummary", () => {
  it("counts one to-do per next-step card that is present", () => {
    expect(computeTodoSummary({ navFailedCount: 2, overdueCount: 5, draftCount: 3 })).toEqual({
      total: 3,
      urgent: 1,
      allDone: false,
    });
  });

  it("does not count the number of invoices, only the cards", () => {
    expect(computeTodoSummary({ navFailedCount: 0, overdueCount: 40, draftCount: 0 }).total).toBe(1);
  });

  it("only the NAV card is urgent", () => {
    expect(computeTodoSummary({ navFailedCount: 0, overdueCount: 1, draftCount: 1 })).toEqual({
      total: 2,
      urgent: 0,
      allDone: false,
    });
    expect(computeTodoSummary({ navFailedCount: 1, overdueCount: 0, draftCount: 0 })).toEqual({
      total: 1,
      urgent: 1,
      allDone: false,
    });
  });

  it("is all done when there is nothing to do", () => {
    expect(computeTodoSummary({ navFailedCount: 0, overdueCount: 0, draftCount: 0 })).toEqual({
      total: 0,
      urgent: 0,
      allDone: true,
    });
  });

  it("treats missing or negative counts as zero", () => {
    expect(computeTodoSummary({ navFailedCount: undefined, overdueCount: -1, draftCount: 0 }).allDone).toBe(true);
  });
});

describe("splitOutstanding", () => {
  it("splits the outstanding amount into not-due and overdue", () => {
    const split = splitOutstanding({
      outstanding: 2223014,
      overdueTotal: 228600,
      outstandingCount: 8,
      overdueCount: 2,
    });
    expect(split.notDue).toBe(1994414);
    expect(split.overdue).toBe(228600);
    expect(split.notDueCount).toBe(6);
    expect(split.overdueCount).toBe(2);
    expect(split.notDueShare + split.overdueShare).toBeCloseTo(1, 10);
    expect(split.overdueShare).toBeCloseTo(228600 / 2223014, 10);
  });

  it("has no shares when nothing is outstanding", () => {
    expect(
      splitOutstanding({ outstanding: 0, overdueTotal: 0, outstandingCount: 0, overdueCount: 0 }),
    ).toMatchObject({ notDue: 0, overdue: 0, notDueShare: 0, overdueShare: 0, hasBar: false });
  });

  it("never goes negative when overdue exceeds outstanding (stale counts)", () => {
    const split = splitOutstanding({
      outstanding: 100,
      overdueTotal: 150,
      outstandingCount: 1,
      overdueCount: 2,
    });
    expect(split.notDue).toBe(0);
    expect(split.notDueCount).toBe(0);
    expect(split.overdue).toBe(100);
    expect(split.overdueShare).toBe(1);
  });

  it("everything overdue leaves a single segment", () => {
    const split = splitOutstanding({
      outstanding: 500,
      overdueTotal: 500,
      outstandingCount: 2,
      overdueCount: 2,
    });
    expect(split.notDueShare).toBe(0);
    expect(split.overdueShare).toBe(1);
    expect(split.hasBar).toBe(true);
  });
});
