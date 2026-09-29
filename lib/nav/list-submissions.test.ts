// lib/nav/list-submissions.test.ts
const mockWhere = jest.fn();
const mockOrderBy = jest.fn(() => mockWhere());
const mockFrom = jest.fn(() => ({ where: () => ({ orderBy: mockOrderBy }) }));
const mockSelect = jest.fn(() => ({ from: mockFrom }));

// Wrapped in an arrow function (deferred call, not embedded directly) —
// jest.mock() factories run before this file's own `const mockSelect = ...`
// has executed (only jest.mock() itself is hoisted above it), so embedding
// mockSelect's value directly here would capture `undefined`.
jest.mock("@/db", () => ({
  db: { select: (...args: unknown[]) => mockSelect(...args) },
}));

jest.mock("@/db/schema", () => ({
  navSubmission: { invoiceId: "invoiceId", createdAt: "createdAt" },
}));

import { listNavSubmissionsForInvoice } from "@/lib/nav/list-submissions";

describe("listNavSubmissionsForInvoice", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the rows for the invoice, most recent first", async () => {
    const rows = [
      { id: "sub-2", invoiceId: "inv-1", status: "done", createdAt: new Date("2026-02-01") },
      { id: "sub-1", invoiceId: "inv-1", status: "pending", createdAt: new Date("2026-01-01") },
    ];
    mockWhere.mockResolvedValue(rows);

    const result = await listNavSubmissionsForInvoice("inv-1");
    expect(result).toEqual(rows);
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });
});
