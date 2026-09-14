// lib/nav/submission-history.test.ts
jest.mock("@/db", () => ({
  db: {
    select: jest.fn(),
  },
}));

import { db } from "@/db";
import { hasSuccessfulNavSubmission } from "@/lib/nav/submission-history";

const mockDb = db as unknown as { select: jest.Mock };

function mockRows(rows: unknown[]) {
  mockDb.select.mockReturnValue({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn().mockResolvedValue(rows),
      })),
    })),
  });
}

describe("hasSuccessfulNavSubmission", () => {
  it("is true when a submission for the invoice reached status \"done\"", async () => {
    mockRows([{ id: "sub-1" }]);
    expect(await hasSuccessfulNavSubmission("inv-1")).toBe(true);
  });

  it("is false when there is no \"done\" submission for the invoice", async () => {
    mockRows([]);
    expect(await hasSuccessfulNavSubmission("inv-1")).toBe(false);
  });
});
