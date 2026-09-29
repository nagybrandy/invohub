// lib/exchange-rates/cache.ts
// DB-backed cache for MNB exchange rates (db/schema.ts's `exchange_rate`
// table). Past dates never change once MNB has published them, so a row is
// cached forever; a cache MISS is never recorded — an absent row just means
// "not fetched (or not yet published) yet", so the next lookup retries
// instead of being stuck on a stale "not found" (important for today's rate,
// which MNB typically doesn't publish until around noon).
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { exchangeRate } from "@/db/schema";
import { createId } from "@/lib/id";

export type CachedRate = { currency: string; rateDate: string; rate: number };

/** Exact (currency, date) cache lookup — the fast path for a date that's a normal MNB business day. */
export async function getCachedRate(currency: string, date: string): Promise<CachedRate | null> {
  const [row] = await db
    .select()
    .from(exchangeRate)
    .where(and(eq(exchangeRate.currency, currency), eq(exchangeRate.rateDate, date)));
  if (!row) return null;
  return { currency: row.currency, rateDate: row.rateDate, rate: Number(row.rate) };
}

/**
 * Caches every rate fetched from MNB for a lookup window, not just the one
 * picked — so a later lookup elsewhere in the same window can hit the exact-
 * date fast path too. `onConflictDoNothing` because a past date's rate never
 * changes: replaying the same day is a safe no-op, never a stale overwrite.
 */
export async function saveRates(rates: CachedRate[]): Promise<void> {
  if (rates.length === 0) return;
  await db
    .insert(exchangeRate)
    .values(
      rates.map((rate) => ({
        id: createId(),
        currency: rate.currency,
        rateDate: rate.rateDate,
        rate: String(rate.rate),
        source: "MNB",
      }))
    )
    .onConflictDoNothing();
}
