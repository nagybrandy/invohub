// lib/api/shared-rate-limit.test.ts
const mockReturning = jest.fn();
const mockOnConflict = jest.fn(() => ({ returning: mockReturning }));
const mockValues = jest.fn(() => ({ onConflictDoUpdate: mockOnConflict }));
const mockInsert = jest.fn(() => ({ values: mockValues }));
const mockDeleteWhere = jest.fn();
const mockDelete = jest.fn(() => ({ where: mockDeleteWhere }));

jest.mock("@/db", () => ({
  db: { insert: (...a: unknown[]) => mockInsert(...(a as [])), delete: (...a: unknown[]) => mockDelete(...(a as [])) },
}));

import {
  checkSharedRateLimit,
  pruneRateLimitBuckets,
  RATE_LIMIT_RETENTION_MS,
} from "@/lib/api/shared-rate-limit";
import { resetRateLimitsForTests } from "@/lib/api/rate-limit";

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 8, 12, 0, 0); // aligned to a minute

describe("checkSharedRateLimit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimitsForTests();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    mockDeleteWhere.mockResolvedValue(undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("allows requests while the DB count is within the limit", async () => {
    mockReturning.mockResolvedValue([{ count: 120 }]);
    const r = await checkSharedRateLimit("v1:k1", 120, MIN, T0 + 5_000, 1);
    expect(r).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("denies at limit+1 with Retry-After = seconds to window end", async () => {
    mockReturning.mockResolvedValue([{ count: 121 }]);
    const r = await checkSharedRateLimit("v1:k1", 120, MIN, T0 + 23_000, 1);
    expect(r).toEqual({ allowed: false, retryAfterSeconds: 37 });
  });

  it("upserts on the minute-aligned window start for the given key", async () => {
    mockReturning.mockResolvedValue([{ count: 1 }]);
    await checkSharedRateLimit("v1:k1", 120, MIN, T0 + 23_000, 1);
    expect(mockValues).toHaveBeenCalledWith({
      bucketKey: "v1:k1",
      windowStart: new Date(T0),
      count: 1,
    });
  });

  it("uses a new window row after rollover", async () => {
    mockReturning.mockResolvedValue([{ count: 1 }]);
    await checkSharedRateLimit("v1:k1", 120, MIN, T0 + 59_000, 1);
    await checkSharedRateLimit("v1:k1", 120, MIN, T0 + 61_000, 1);
    const starts = (mockValues.mock.calls as unknown as Array<[{ windowStart: Date }]>).map(
      (c) => c[0].windowStart.getTime()
    );
    expect(starts).toEqual([T0, T0 + MIN]);
  });

  it("keeps different keys in different rows", async () => {
    mockReturning.mockResolvedValue([{ count: 1 }]);
    await checkSharedRateLimit("v1:k1", 120, MIN, T0, 1);
    await checkSharedRateLimit("v1:k2", 120, MIN, T0, 1);
    const keys = (mockValues.mock.calls as unknown as Array<[{ bucketKey: string }]>).map(
      (c) => c[0].bucketKey
    );
    expect(keys).toEqual(["v1:k1", "v1:k2"]);
  });

  it("falls back to the in-memory limiter when the DB throws (fail open, then limit)", async () => {
    mockReturning.mockRejectedValue(new Error("neon down"));
    let last = await checkSharedRateLimit("v1:k1", 2, MIN, T0, 1);
    expect(last.allowed).toBe(true);
    last = await checkSharedRateLimit("v1:k1", 2, MIN, T0, 1);
    expect(last.allowed).toBe(true);
    last = await checkSharedRateLimit("v1:k1", 2, MIN, T0, 1);
    expect(last.allowed).toBe(false);
    expect(console.warn).toHaveBeenCalled();
    const logged = (console.warn as jest.Mock).mock.calls.flat().join(" ");
    expect(logged).toContain("v1:k1");
    expect(logged).not.toContain("neon down");
  });

  it("falls back when the DB returns no row", async () => {
    mockReturning.mockResolvedValue([]);
    const r = await checkSharedRateLimit("v1:k9", 120, MIN, T0, 1);
    expect(r.allowed).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });

  it("opportunistically prunes old windows (bounded) when the sample hits", async () => {
    mockReturning.mockResolvedValue([{ count: 1 }]);
    await checkSharedRateLimit("v1:k1", 120, MIN, T0, 0); // random=0 -> prune
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("does not prune when the sample misses", async () => {
    mockReturning.mockResolvedValue([{ count: 1 }]);
    await checkSharedRateLimit("v1:k1", 120, MIN, T0, 0.5);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("a failing prune never affects the decision", async () => {
    mockReturning.mockResolvedValue([{ count: 1 }]);
    mockDeleteWhere.mockRejectedValue(new Error("boom"));
    const r = await checkSharedRateLimit("v1:k1", 120, MIN, T0, 0);
    expect(r.allowed).toBe(true);
  });
});

describe("pruneRateLimitBuckets", () => {
  it("deletes only rows older than the retention cutoff", async () => {
    mockDeleteWhere.mockResolvedValue(undefined);
    expect(RATE_LIMIT_RETENTION_MS).toBe(10 * MIN);
    await pruneRateLimitBuckets(T0);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
  });
});
