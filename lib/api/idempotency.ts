// lib/api/idempotency.ts
// Idempotency-Key support for the state-creating v1 POST endpoints (create,
// finalize, storno, modify, convert, send — see db/schema.ts's
// idempotencyKey table).
//
// Claim-first, not check-then-act: a request atomically inserts an
// "in progress" row against the (user_id, key) unique index BEFORE doing any
// work, so of two concurrent requests with the same key (the classic
// timeout-then-retry case) exactly one runs; the other gets 409 + Retry-After
// and, once the first finishes, a replay. The key is bound to the method +
// path + body, so reusing a key on a different endpoint or invoice is a
// conflict, never someone else's replayed response. 5xx results and thrown
// errors release the key so the client can retry.
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { idempotencyKey } from "@/db/schema";
import { createId } from "@/lib/id";

export const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 255;

export type IdempotentResult = { status: number; body: unknown };

export type StoredIdempotentRequest = {
  requestHash: string;
  /** null while the first request is still running. */
  responseStatus: number | null;
  responseBody: string | null;
  createdAt: Date;
};

export interface IdempotencyStore {
  /** Removes the user's row for `key` if it was created before `olderThan`. */
  purgeExpired(userId: string, key: string, olderThan: Date): Promise<void>;
  /** Atomically inserts an in-progress row; false when (userId, key) already exists. */
  claim(userId: string, key: string, requestHash: string, now: Date): Promise<boolean>;
  find(userId: string, key: string): Promise<StoredIdempotentRequest | null>;
  complete(userId: string, key: string, status: number, body: string): Promise<void>;
  release(userId: string, key: string): Promise<void>;
}

const byUserAndKey = (userId: string, key: string) =>
  and(eq(idempotencyKey.userId, userId), eq(idempotencyKey.key, key));

export const postgresIdempotencyStore: IdempotencyStore = {
  async purgeExpired(userId, key, olderThan) {
    await db.delete(idempotencyKey).where(and(byUserAndKey(userId, key), lt(idempotencyKey.createdAt, olderThan)));
  },
  async claim(userId, key, requestHash, now) {
    const inserted = await db
      .insert(idempotencyKey)
      .values({ id: createId(), userId, key, requestHash, createdAt: now })
      .onConflictDoNothing()
      .returning({ id: idempotencyKey.id });
    return inserted.length > 0;
  },
  async find(userId, key) {
    const [row] = await db.select().from(idempotencyKey).where(byUserAndKey(userId, key));
    return row ?? null;
  },
  async complete(userId, key, status, body) {
    await db
      .update(idempotencyKey)
      .set({ responseStatus: status, responseBody: body })
      .where(byUserAndKey(userId, key));
  },
  async release(userId, key) {
    await db.delete(idempotencyKey).where(byUserAndKey(userId, key));
  },
};

export type IdempotencyFingerprint = { method: string; path: string; body: unknown };

export type IdempotencyOutcome =
  | { kind: "replay"; status: number; body: unknown }
  | { kind: "conflict" }
  | { kind: "in_progress" }
  | {
      kind: "proceed";
      complete: (result: IdempotentResult) => Promise<void>;
      release: () => Promise<void>;
    };

/** Order-independent so `{a:1,b:2}` and `{b:2,a:1}` hash the same. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export async function beginIdempotentRequest(
  userId: string,
  key: string,
  fingerprint: IdempotencyFingerprint,
  store: IdempotencyStore = postgresIdempotencyStore,
  now: Date = new Date()
): Promise<IdempotencyOutcome> {
  const requestHash = stableStringify(fingerprint);
  await store.purgeExpired(userId, key, new Date(now.getTime() - IDEMPOTENCY_WINDOW_MS));

  if (await store.claim(userId, key, requestHash, now)) {
    return {
      kind: "proceed",
      complete: async (result) => {
        if (result.status >= 500) {
          await store.release(userId, key);
          return;
        }
        await store.complete(userId, key, result.status, JSON.stringify(result.body));
      },
      release: () => store.release(userId, key),
    };
  }

  const existing = await store.find(userId, key);
  // Released between our failed claim and this read (the other request
  // errored) — tell the caller to retry rather than racing it again here.
  if (!existing) return { kind: "in_progress" };
  if (existing.requestHash !== requestHash) return { kind: "conflict" };
  if (existing.responseStatus === null || existing.responseBody === null) return { kind: "in_progress" };
  return { kind: "replay", status: existing.responseStatus, body: JSON.parse(existing.responseBody) };
}

/**
 * Wraps a v1 POST handler body with Idempotency-Key semantics. `handler`
 * does the real work and returns the {status, body} to send — this function
 * only decides whether to run it, replay a stored response, or reject, and
 * always returns a plain Response.
 */
export async function withIdempotency(
  request: Request,
  userId: string,
  requestBody: unknown,
  handler: () => Promise<IdempotentResult>,
  store: IdempotencyStore = postgresIdempotencyStore
): Promise<Response> {
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) {
    const result = await handler();
    return Response.json(result.body, { status: result.status });
  }
  if (key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    return Response.json(
      {
        error: `Idempotency-Key must be at most ${IDEMPOTENCY_KEY_MAX_LENGTH} characters.`,
        code: "idempotencyKeyTooLong",
      },
      { status: 400 }
    );
  }

  const outcome = await beginIdempotentRequest(
    userId,
    key,
    { method: request.method, path: new URL(request.url).pathname, body: requestBody },
    store
  );

  if (outcome.kind === "conflict") {
    return Response.json(
      {
        error: "Idempotency-Key was already used with a different request (endpoint or body).",
        code: "idempotencyKeyConflict",
      },
      { status: 422 }
    );
  }
  if (outcome.kind === "in_progress") {
    return Response.json(
      {
        error: "A request with this Idempotency-Key is still being processed. Retry shortly.",
        code: "idempotencyKeyInProgress",
      },
      { status: 409, headers: { "Retry-After": "1" } }
    );
  }
  if (outcome.kind === "replay") {
    return Response.json(outcome.body, { status: outcome.status });
  }

  let result: IdempotentResult;
  try {
    result = await handler();
  } catch (error) {
    await outcome.release();
    throw error;
  }
  await outcome.complete(result);
  return Response.json(result.body, { status: result.status });
}
