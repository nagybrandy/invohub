// lib/nav/submission-store.test.ts
const mockValues = jest.fn().mockResolvedValue(undefined);
const mockInsert = jest.fn(() => ({ values: mockValues }));
const mockUpdateWhere = jest.fn().mockResolvedValue(undefined);
const mockSet = jest.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = jest.fn(() => ({ set: mockSet }));
const mockDeleteWhere = jest.fn().mockResolvedValue(undefined);
const mockDelete = jest.fn(() => ({ where: mockDeleteWhere }));

jest.mock("@/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...(args as [])),
    update: (...args: unknown[]) => mockUpdate(...(args as [])),
    delete: (...args: unknown[]) => mockDelete(...(args as [])),
  },
}));

const mockList = jest.fn();
jest.mock("@/lib/nav/list-submissions", () => ({
  listNavSubmissionsForInvoice: (...args: unknown[]) => mockList(...args),
}));

import {
  claimNavSubmission,
  getNavSubmissionRecord,
  markNavSubmissionFailed,
  markNavSubmissionSent,
  releaseNavSubmissionClaim,
} from "@/lib/nav/submission-store";

describe("submission-store", () => {
  beforeEach(() => jest.clearAllMocks());

  it("claims with a pending row and leaves createdAt to the database clock", async () => {
    const id = await claimNavSubmission("inv-1", "test");
    expect(id).toBeTruthy();
    const values = mockValues.mock.calls[0][0];
    expect(values).toEqual({ id, invoiceId: "inv-1", status: "pending", mode: "test" });
    expect(values).not.toHaveProperty("createdAt");
  });

  it("marks sent with the transaction id and clears any error", async () => {
    await markNavSubmissionSent("s1", "TX-1");
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent", transactionId: "TX-1", errorMessage: null })
    );
  });

  it("marks failed as status error with a length-capped message", async () => {
    await markNavSubmissionFailed("s1", "x".repeat(5000));
    const set = (mockSet.mock.calls as unknown as Array<[{ status: string; errorMessage: string }]>)[0][0];
    expect(set.status).toBe("error");
    expect(set.errorMessage).toHaveLength(2000);
  });

  it("releases a claim by deleting the row", async () => {
    await releaseNavSubmissionClaim("s1");
    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("reads back one record by id", async () => {
    mockList.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    expect(await getNavSubmissionRecord("inv-1", "b")).toEqual({ id: "b" });
    expect(await getNavSubmissionRecord("inv-1", "zzz")).toBeNull();
  });
});
