// lib/invoices/status-visuals.test.ts
import {
  isOverdue,
  overdueDays,
  STATUS_VISUALS,
} from "@/lib/invoices/status-visuals";
import type { InvoiceStatus } from "@/lib/invoices/types";

const ALL_STATUSES = Object.keys(STATUS_VISUALS) as InvoiceStatus[];

describe("STATUS_VISUALS", () => {
  it("maps paid to the single approved green", () => {
    expect(STATUS_VISUALS.paid.text).toBe("text-[#15803d]");
    expect(STATUS_VISUALS.paid.chip).toContain("#15803d");
    expect(STATUS_VISUALS.paid.border).toContain("#15803d");
  });

  it("never maps any other status to green (L3, V5)", () => {
    for (const status of ALL_STATUSES) {
      if (status === "paid") continue;
      const visual = STATUS_VISUALS[status];
      const combined = `${visual.chip} ${visual.text} ${visual.border}`;
      expect(combined).not.toMatch(/green/i);
      expect(combined).not.toMatch(/#15803d/i);
    }
  });

  it("covers every InvoiceStatus", () => {
    expect(ALL_STATUSES.sort()).toEqual(
      [
        "draft",
        "proforma",
        "sent",
        "paid",
        "partially_paid",
        "unpaid",
        "overdue",
        "cancelled",
      ].sort()
    );
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-09-14T12:00:00Z");

  it("is true for a sent invoice whose due date has passed", () => {
    expect(isOverdue({ status: "sent", dueDate: "2026-08-30" }, now)).toBe(true);
  });

  it("is true for unpaid / partially_paid too", () => {
    expect(isOverdue({ status: "unpaid", dueDate: "2026-08-30" }, now)).toBe(true);
    expect(isOverdue({ status: "partially_paid", dueDate: "2026-08-30" }, now)).toBe(true);
  });

  it("is false when the due date is today or in the future", () => {
    expect(isOverdue({ status: "sent", dueDate: "2026-09-14" }, now)).toBe(false);
    expect(isOverdue({ status: "sent", dueDate: "2026-09-20" }, now)).toBe(false);
  });

  it("is false for statuses that are not awaiting payment", () => {
    expect(isOverdue({ status: "paid", dueDate: "2026-08-30" }, now)).toBe(false);
    expect(isOverdue({ status: "draft", dueDate: "2026-08-30" }, now)).toBe(false);
    expect(isOverdue({ status: "cancelled", dueDate: "2026-08-30" }, now)).toBe(false);
  });
});

describe("overdueDays", () => {
  const now = new Date("2026-09-14T12:00:00Z");

  it("counts whole days since the due date", () => {
    expect(overdueDays({ dueDate: "2026-08-30" }, now)).toBe(15);
  });

  it("floors at 0 for a due date today or in the future", () => {
    expect(overdueDays({ dueDate: "2026-09-14" }, now)).toBe(0);
    expect(overdueDays({ dueDate: "2026-09-20" }, now)).toBe(0);
  });
});
