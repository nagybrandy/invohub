// lib/invoices/status-visuals.test.ts
import { STATUS_VISUALS, isOverdue, overdueDays } from "@/lib/invoices/status-visuals";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

describe("STATUS_VISUALS", () => {
  it("is the only status whose chip color is the green/#15803d family for paid", () => {
    expect(STATUS_VISUALS.paid.text).toContain("15803d");
    expect(STATUS_VISUALS.paid.chip).toContain("15803d");
  });

  it("never uses the green family for any other status", () => {
    for (const [status, visual] of Object.entries(STATUS_VISUALS)) {
      if (status === "paid") continue;
      expect(visual.chip).not.toContain("15803d");
      expect(visual.text).not.toContain("15803d");
      expect(visual.chip.toLowerCase()).not.toContain("green");
      expect(visual.text.toLowerCase()).not.toContain("green");
    }
  });

  it("has an entry for every invoice status", () => {
    const statuses = [
      "draft",
      "proforma",
      "sent",
      "paid",
      "partially_paid",
      "unpaid",
      "overdue",
      "cancelled",
    ];
    for (const status of statuses) {
      expect(STATUS_VISUALS).toHaveProperty(status);
    }
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-09-14T12:00:00.000Z");

  it("is true for a stored overdue status", () => {
    expect(isOverdue(makeInvoice({ status: "overdue", dueDate: "2026-09-01" }), now)).toBe(true);
  });

  it("is true for a still-`sent` invoice whose due date has passed (D3)", () => {
    expect(isOverdue(makeInvoice({ status: "sent", dueDate: "2026-09-01" }), now)).toBe(true);
  });

  it("is false for a sent invoice not yet due", () => {
    expect(isOverdue(makeInvoice({ status: "sent", dueDate: "2026-10-01" }), now)).toBe(false);
  });

  it("is false for paid and draft invoices regardless of due date", () => {
    expect(isOverdue(makeInvoice({ status: "paid", dueDate: "2026-01-01" }), now)).toBe(false);
    expect(isOverdue(makeInvoice({ status: "draft", dueDate: "2026-01-01" }), now)).toBe(false);
  });
});

describe("overdueDays", () => {
  const now = new Date("2026-09-14T12:00:00.000Z");

  it("counts whole days since the due date", () => {
    expect(overdueDays(makeInvoice({ status: "sent", dueDate: "2026-08-30" }), now)).toBe(15);
  });

  it("is 0 for an invoice that is not overdue", () => {
    expect(overdueDays(makeInvoice({ status: "paid", dueDate: "2026-08-30" }), now)).toBe(0);
  });
});
