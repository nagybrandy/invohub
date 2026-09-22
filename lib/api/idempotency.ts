// lib/api/idempotency.ts
// Idempotency-Key support for the state-creating v1 POST endpoints (create,
// finalize, storno, modify, convert, send — see db/schema.ts's
// idempotencyKey table). Same key + same user + same request body within
// IDEMPOTENCY_WINDOW_MS replays the first response verbatim; same key with
// a different body is a conflict the caller should surface as 422.
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { idempotencyKey } from "@/db/schema";
import { createId } from "@/lib/id";

export const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type IdempotentResult = { status: number; body: unknown };

export type IdempotencyOutcome =
  | { kind: "replay"; status: number; body: unknown }
  | { kind: "conflict" }
  | { kind: "proceed"; save: (result: IdempotentResult) => Promise<void> };

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

function hashRequestBody(body: unknown): string {
  return stableStringify(body);
}

export async function beginIdempotentRequest(
  userId: string,
  key: string,
  body: unknown
): Promise<IdempotencyOutcome> {
  const requestHash = hashRequestBody(body);

  const [existing] = await db
    .select()
    .from(idempotencyKey)
    .where(and(eq(idempotencyKey.userId, userId), eq(idempotencyKey.key, key)));

  if (existing) {
    const age = Date.now() - existing.createdAt.getTime();
    if (age < IDEMPOTENCY_WINDOW_MS) {
      if (existing.requestHash !== requestHash) {
        return { kind: "conflict" };
      }
      return {
        kind: "replay",
        status: existing.responseStatus,
        body: JSON.parse(existing.responseBody),
      };
    }
    // Expired — remove so a fresh key/body pair can be recorded below.
    await db.delete(idempotencyKey).where(eq(idempotencyKey.id, existing.id));
  }

  return {
    kind: "proceed",
    save: async (result) => {
      await db
        .insert(idempotencyKey)
        .values({
          id: createId(),
          userId,
          key,
          requestHash,
          responseStatus: result.status,
          responseBody: JSON.stringify(result.body),
          createdAt: new Date(),
        })
        .onConflictDoNothing();
    },
  };
}

/**
 * Wraps a v1 POST handler body with Idempotency-Key semantics. `handler`
 * does the real work and returns the {status, body} to send — this function
 * only decides whether to run it, replay a stored response, or reject as a
 * conflict, and always returns a plain Response.
 */
export async function withIdempotency(
  request: Request,
  userId: string,
  requestBody: unknown,
  handler: () => Promise<IdempotentResult>
): Promise<Response> {
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) {
    const result = await handler();
    return Response.json(result.body, { status: result.status });
  }

  const outcome = await beginIdempotentRequest(userId, key, requestBody);
  if (outcome.kind === "conflict") {
    return Response.json(
      {
        error: "Idempotency-Key was already used with a different request body.",
        code: "idempotencyKeyConflict",
      },
      { status: 422 }
    );
  }
  if (outcome.kind === "replay") {
    return Response.json(outcome.body, { status: outcome.status });
  }

  const result = await handler();
  await outcome.save(result);
  return Response.json(result.body, { status: result.status });
}
