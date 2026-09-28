// lib/nav/latest-submission.test.ts
import { latestStatusByInvoice } from "@/lib/nav/latest-submission";

describe("latestStatusByInvoice", () => {
  it("keeps the newest row per invoice regardless of arrival order", () => {
    const m = latestStatusByInvoice([
      { invoiceId: "a", status: "done", createdAt: "2026-09-02T10:00:00Z" },
      { invoiceId: "a", status: "error", createdAt: "2026-09-01T10:00:00Z" },
      { invoiceId: "b", status: "error", createdAt: "2026-09-03T10:00:00Z" },
      { invoiceId: "b", status: "pending", createdAt: "2026-09-04T10:00:00Z" },
    ]);
    expect(m.get("a")).toBe("done");   // the older error is superseded
    expect(m.get("b")).toBe("pending"); // a retry after a failure is in progress
  });

  it("returns an empty map for no rows", () => {
    expect(latestStatusByInvoice([]).size).toBe(0);
  });
});
