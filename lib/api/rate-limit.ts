// lib/api/rate-limit.ts
// Simple in-memory fixed-window rate limiter for unauthenticated API
// routes (there is no external store — Redis/etc — wired up in this repo).
// Per-process, so on a multi-instance deployment each instance enforces
// its own window; still a real, meaningful throttle on any single warm
// instance, which is what stands between an unauthenticated endpoint and
// unthrottled brute-force/enumeration.
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/**
 * `key` should identify the caller (e.g. `${routeName}:${clientIp}`).
 * `limit` requests are allowed per `windowMs`.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Best-effort client IP from standard proxy headers; falls back to a shared bucket when absent. */
export function clientIpFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/** Test-only: clears all buckets so tests don't bleed into each other. */
export function resetRateLimitsForTests(): void {
  buckets.clear();
}
