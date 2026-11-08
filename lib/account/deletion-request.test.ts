/** @jest-environment node */
// Request / cancel / status for the (gated) self-serve deletion flow. Only
// the account_deletion_request table is touched — never user data.
const mockInsertValues = jest.fn();
const mockUpdateSet = jest.fn();
const mockSelectRows = jest.fn();
let lastTable: unknown;

jest.mock("@/db", () => {
  const chain = (rowsFn: () => unknown) => {
    const p: any = {
      from: () => p,
      where: () => p,
      orderBy: () => p,
      limit: () => p,
      returning: () => Promise.resolve(rowsFn()),
      then: (res: any, rej: any) => Promise.resolve(rowsFn()).then(res, rej),
    };
    return p;
  };
  return {
    db: {
      select: () => chain(() => mockSelectRows()),
      insert: (t: unknown) => {
        lastTable = t;
        return { values: (v: unknown) => (mockInsertValues(v), chain(() => [v])) };
      },
      update: (t: unknown) => {
        lastTable = t;
        return { set: (v: unknown) => (mockUpdateSet(v), chain(() => mockSelectRows())) };
      },
      delete: () => {
        throw new Error("deletion request flow must never delete rows");
      },
    },
  };
});

import { accountDeletionRequest } from "@/db/schema";
import {
  DELETION_GRACE_DAYS,
  cancelDeletionRequest,
  getDeletionStatus,
  requestDeletion,
} from "@/lib/account/deletion-request";

const NOW = new Date("2026-11-08T10:00:00Z");

beforeEach(() => {
  mockInsertValues.mockReset();
  mockUpdateSet.mockReset();
  mockSelectRows.mockReset();
});

describe("requestDeletion", () => {
  it("creates a requested row scheduled DELETION_GRACE_DAYS ahead for the person's own account", async () => {
    mockSelectRows.mockReturnValue([]); // no open request
    const res = await requestDeletion({ userId: "u1", reason: "  switching  ", now: NOW });
    expect(res.status).toBe("requested");
    const values = mockInsertValues.mock.calls[0][0];
    expect(values).toMatchObject({ userId: "u1", billingAccountId: "u1", status: "requested", reason: "switching" });
    expect(values.scheduledFor).toEqual(new Date(NOW.getTime() + DELETION_GRACE_DAYS * 86_400_000));
    expect(lastTable).toBe(accountDeletionRequest);
  });
  it("is idempotent: an existing open request is returned, nothing inserted", async () => {
    const open = { id: "r1", status: "requested", scheduledFor: new Date("2026-12-01") };
    mockSelectRows.mockReturnValue([open]);
    const res = await requestDeletion({ userId: "u1", now: NOW });
    expect(res).toMatchObject({ id: "r1", alreadyRequested: true });
    expect(mockInsertValues).not.toHaveBeenCalled();
  });
  it("caps the reason length and drops blank reasons", async () => {
    mockSelectRows.mockReturnValue([]);
    await requestDeletion({ userId: "u1", reason: "   ", now: NOW });
    expect(mockInsertValues.mock.calls[0][0].reason).toBeNull();
    await requestDeletion({ userId: "u1", reason: "x".repeat(5000), now: NOW });
    expect(mockInsertValues.mock.calls[1][0].reason).toHaveLength(500);
  });
  it("30-day grace period (product proposal)", () => {
    expect(DELETION_GRACE_DAYS).toBe(30);
  });
});

describe("cancelDeletionRequest", () => {
  it("marks the open request cancelled and returns it", async () => {
    mockSelectRows.mockReturnValue([{ id: "r1", status: "cancelled" }]);
    const res = await cancelDeletionRequest({ userId: "u1", now: NOW });
    expect(res).toMatchObject({ id: "r1" });
    expect(mockUpdateSet).toHaveBeenCalledWith({ status: "cancelled", cancelledAt: NOW });
  });
  it("returns null when nothing was open", async () => {
    mockSelectRows.mockReturnValue([]);
    expect(await cancelDeletionRequest({ userId: "u1", now: NOW })).toBeNull();
  });
});

describe("getDeletionStatus", () => {
  it("reports no request", async () => {
    mockSelectRows.mockReturnValue([]);
    expect(await getDeletionStatus("u1")).toEqual({ status: "none", request: null });
  });
  it("reports the latest request", async () => {
    const r = { id: "r1", status: "requested", scheduledFor: new Date("2026-12-08") };
    mockSelectRows.mockReturnValue([r]);
    expect(await getDeletionStatus("u1")).toEqual({ status: "requested", request: r });
  });
});
