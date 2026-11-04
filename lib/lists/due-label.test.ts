import { dueLabel } from "@/lib/lists/due-label";

const now = new Date("2026-11-03T10:00:00");

describe("dueLabel", () => {
  it("counts the days left for an open invoice", () => {
    expect(dueLabel({ status: "sent", dueDate: "2026-11-09" }, now)).toEqual({ kind: "upcoming", days: 6 });
  });
  it("reports how long an overdue invoice has been overdue", () => {
    expect(dueLabel({ status: "unpaid", dueDate: "2026-10-21" }, now)).toEqual({ kind: "overdue", days: 13 });
  });
  it("shows nothing for paid, cancelled and draft documents", () => {
    expect(dueLabel({ status: "paid", dueDate: "2026-11-09" }, now)).toBeNull();
    expect(dueLabel({ status: "cancelled", dueDate: "2026-11-09" }, now)).toBeNull();
    expect(dueLabel({ status: "draft", dueDate: "2026-11-09" }, now)).toBeNull();
  });
  it("shows 0 days on the due date itself", () => {
    expect(dueLabel({ status: "sent", dueDate: "2026-11-03" }, now)).toEqual({ kind: "upcoming", days: 0 });
  });
});
