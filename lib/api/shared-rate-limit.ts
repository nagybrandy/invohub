// lib/api/shared-rate-limit.ts
// Per-key fixed-window rate limiter shared across serverless instances,
// backed by Neon (table api_rate_limit_bucket). One atomic upsert per
// request; no interactive transaction, so it works over neon-http.
// If the DB call fails we fail OPEN to the per-process in-memory limiter so
// the API stays up (the limit is then per instance until the DB recovers).
import { and, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiRateLimitBucket } from "@/db/schema";
import { checkRateLimit, type RateLimitResult } from "@/lib/api/rate-limit";

/** Windows older than this are eligible for deletion. */
export const RATE_LIMIT_RETENTION_MS = 10 * 60_000;
/** Probability that a request triggers a prune. */
const PRUNE_SAMPLE_RATE = 0.01;
/** Max rows removed per prune, so a backlog never causes a long delete. */
const PRUNE_BATCH_SIZE = 500;

/** Delete a bounded batch of expired windows. Throws on DB error. */
export async function pruneRateLimitBuckets(now: number = Date.now()): Promise<void> {
  const cutoff = new Date(now - RATE_LIMIT_RETENTION_MS);
  await db
    .delete(apiRateLimitBucket)
    .where(
      and(
        lt(apiRateLimitBucket.windowStart, cutoff),
        sql`ctid IN (SELECT ctid FROM api_rate_limit_bucket WHERE window_start < ${cutoff} LIMIT ${PRUNE_BATCH_SIZE})`
      )
    );
}

/**
 * `key` must identify the caller without secrets (e.g. `v1:${apiKeyId}`).
 * `now` and `random` are injectable for tests.
 */
export async function checkSharedRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
  random: number = Math.random()
): Promise<RateLimitResult> {
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  try {
    const rows = await db
      .insert(apiRateLimitBucket)
      .values({ bucketKey: key, windowStart: new Date(windowStartMs), count: 1 })
      .onConflictDoUpdate({
        target: [apiRateLimitBucket.bucketKey, apiRateLimitBucket.windowStart],
        set: { count: sql`${apiRateLimitBucket.count} + 1` },
      })
      .returning({ count: apiRateLimitBucket.count });

    const count = rows[0]?.count;
    if (typeof count !== "number") throw new Error("no count returned");

    if (random < PRUNE_SAMPLE_RATE) {
      pruneRateLimitBuckets(now).catch(() => {
        /* best effort; never affects the decision */
      });
    }

    if (count > limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((windowStartMs + windowMs - now) / 1000));
      return { allowed: false, retryAfterSeconds };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  } catch {
    // Key id only: no secrets, no error text (could echo SQL parameters).
    console.warn(`[rate-limit] shared store unavailable for ${key}; using in-memory fallback`);
    return checkRateLimit(key, limit, windowMs);
  }
}
