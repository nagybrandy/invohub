// lib/invoices/status-visuals.test.ts
import { STATUS_VISUALS, isOverdue, overdueDays } from "@/lib/invoices/status-visuals";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

describe("STATUS_VISUALS (tokens.md §6.4)", () => {
  it("paid is the green ok pair", () => {
    expect(STATUS_VISUALS.paid.chip).toBe("bg-ok-wash");
    expect(STATUS_VISUALS.paid.text).toBe("text-ok");
  });

  it("only paid uses the ok colours", () => {
    for (const [status, visual] of Object.entries(STATUS_VISUALS)) {
      if (status === "paid") continue;
      expect(visual.chip).not.toContain("ok");
      expect(visual.text).not.toContain("ok");
      expect(visual.chip.toLowerCase()).not.toContain("green");
    }
  });

  it("overdue is the only red status", () => {
    expect(STATUS_VISUALS.overdue.chip).toBe("bg-err-wash");
    expect(STATUS_VISUALS.overdue.text).toBe("text-err");
    for (const [status, visual] of Object.entries(STATUS_VISUALS)) {
      if (status === "overdue") continue;
      expect(visual.text).not.toContain("err");
    }
  });

  it("waiting statuses (sent, unpaid) are the primary wash; partly paid is warn", () => {
    for (const status of ["sent", "unpaid"] as const) {
      expect(STATUS_VISUALS[status].chip).toBe("bg-primary-wash");
      expect(STATUS_VISUALS[status].text).toBe("text-primary-ink");
    }
    expect(STATUS_VISUALS.partially_paid.chip).toBe("bg-warn-wash");
    expect(STATUS_VISUALS.partially_paid.text).toBe("text-warn");
  });

  it("draft, proforma and cancelled share the neutral wash", () => {
    for (const status of ["draft", "proforma", "cancelled"] as const) {
      expect(STATUS_VISUALS[status].chip).toBe("bg-neutral-wash");
      expect(STATUS_VISUALS[status].text).toBe("text-muted-ink");
    }
  });

  it("uses token classes only (no hard-coded hex)", () => {
    for (const visual of Object.values(STATUS_VISUALS)) {
      expect(`${visual.chip} ${visual.text} ${visual.border}`).not.toMatch(/#[0-9a-fA-F]{3,6}/);
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
