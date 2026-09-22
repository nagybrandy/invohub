// lib/api/idempotency.test.ts
// In-memory fake for the idempotency_key table so beginIdempotentRequest's
// replay/conflict/expiry behavior can be asserted without a live Postgres
// connection (see db/schema.ts's idempotencyKey table). Row storage lives on
// `globalThis` (not a module-scoped variable) because jest.mock() factories
// may not close over out-of-scope variables.
type Row = {
  id: string;
  userId: string;
  key: string;
  requestHash: string;
  responseStatus: number;
  responseBody: string;
  createdAt: Date;
};

type Fake = { rows: Row[]; filter: ((r: Row) => boolean) | null };

function fake(): Fake {
  const g = globalThis as unknown as { __idempotencyFake?: Fake };
  if (!g.__idempotencyFake) {
    g.__idempotencyFake = { rows: [], filter: null };
  }
  return g.__idempotencyFake;
}

jest.mock("@/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(async () => {
          const f = (globalThis as unknown as { __idempotencyFake: Fake }).__idempotencyFake;
          return f.rows.filter((r) => f.filter?.(r) ?? true);
        }),
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn((value: Row) => ({
        onConflictDoNothing: jest.fn(async () => {
          const f = (globalThis as unknown as { __idempotencyFake: Fake }).__idempotencyFake;
          if (f.rows.some((r) => r.userId === value.userId && r.key === value.key)) {
            return [];
          }
          f.rows.push(value);
          return [value];
        }),
      })),
    })),
    delete: jest.fn(() => ({
      where: jest.fn(async () => {
        const f = (globalThis as unknown as { __idempotencyFake: Fake }).__idempotencyFake;
        f.rows = f.rows.filter((r) => !(f.filter?.(r) ?? false));
        return { rowCount: 1 };
      }),
    })),
  },
}));

// drizzle-orm's `and`/`eq` builders just need to produce something the fake
// `where`/`delete` above can turn into a predicate closure.
jest.mock("drizzle-orm", () => ({
  and:
    (...preds: Array<(r: Row) => boolean>) =>
    (r: Row) =>
      preds.every((p) => p(r)),
  eq: (column: string, value: unknown) => (r: Row) => (r as never)[column] === value,
}));

jest.mock("@/db/schema", () => ({
  idempotencyKey: {
    userId: "userId",
    key: "key",
    id: "id",
  },
}));

import { and, eq } from "drizzle-orm";
import { idempotencyKey } from "@/db/schema";
import { beginIdempotentRequest } from "@/lib/api/idempotency";

describe("beginIdempotentRequest", () => {
  beforeEach(() => {
    fake().rows = [];
    // Mirrors what lib/api/idempotency.ts itself builds — `and(eq(userId), eq(key))`.
    fake().filter = and(
      eq(idempotencyKey.userId as never, "user-1" as never),
      eq(idempotencyKey.key as never, "key-1" as never)
    ) as never;
    jest.clearAllMocks();
  });

  function setFilter(userId: string, key: string) {
    fake().filter = and(
      eq(idempotencyKey.userId as never, userId as never),
      eq(idempotencyKey.key as never, key as never)
    ) as never;
  }

  it("returns a 'proceed' outcome for a never-seen key, and save() persists the response", async () => {
    setFilter("user-1", "key-1");
    const outcome = await beginIdempotentRequest("user-1", "key-1", { a: 1 });
    expect(outcome.kind).toBe("proceed");
    if (outcome.kind !== "proceed") throw new Error("unreachable");

    await outcome.save({ status: 201, body: { invoice: { id: "inv-1" } } });
    expect(fake().rows).toHaveLength(1);
    expect(fake().rows[0]).toMatchObject({
      userId: "user-1",
      key: "key-1",
      responseStatus: 201,
    });
  });

  it("replays the stored response for the same key + same body", async () => {
    setFilter("user-1", "key-1");
    const first = await beginIdempotentRequest("user-1", "key-1", { a: 1 });
    if (first.kind !== "proceed") throw new Error("unreachable");
    await first.save({ status: 201, body: { invoice: { id: "inv-1" } } });

    const second = await beginIdempotentRequest("user-1", "key-1", { a: 1 });
    expect(second).toEqual({
      kind: "replay",
      status: 201,
      body: { invoice: { id: "inv-1" } },
    });
  });

  it("returns a conflict outcome for the same key with a different body", async () => {
    setFilter("user-1", "key-1");
    const first = await beginIdempotentRequest("user-1", "key-1", { a: 1 });
    if (first.kind !== "proceed") throw new Error("unreachable");
    await first.save({ status: 201, body: { invoice: { id: "inv-1" } } });

    const second = await beginIdempotentRequest("user-1", "key-1", { a: 2 });
    expect(second.kind).toBe("conflict");
  });

  it("treats an expired (>24h old) row as not found and proceeds again", async () => {
    setFilter("user-1", "key-1");
    const first = await beginIdempotentRequest("user-1", "key-1", { a: 1 });
    if (first.kind !== "proceed") throw new Error("unreachable");
    await first.save({ status: 201, body: { invoice: { id: "inv-1" } } });

    fake().rows[0].createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);

    const second = await beginIdempotentRequest("user-1", "key-1", { a: 2 });
    expect(second.kind).toBe("proceed");
  });

  it("scopes keys per user — a different user with the same key never sees a replay or conflict", async () => {
    setFilter("user-1", "key-1");
    const first = await beginIdempotentRequest("user-1", "key-1", { a: 1 });
    if (first.kind !== "proceed") throw new Error("unreachable");
    await first.save({ status: 201, body: { invoice: { id: "inv-1" } } });

    setFilter("user-2", "key-1");
    const otherUser = await beginIdempotentRequest("user-2", "key-1", { a: 999 });
    expect(otherUser.kind).toBe("proceed");
  });
});
