// lib/account/deletion-request.ts
// Request / cancel / status for the self-serve account deletion flow
// (feature-flagged OFF — lib/account/deletion-flag.ts; proposal:
// docs/decisions/2026-11-08-self-serve-account-deletion.md).
//
// REVERSIBLE ONLY. This module reads and writes the account_deletion_request
// table and nothing else. It deliberately does not import lib/account/closure
// (the executable closure) — a test in deletion-plan.test.ts keeps it so.
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accountDeletionRequest } from "@/db/schema";

/** Cancellable waiting period between request and (future) closure. Product proposal, not a legal figure. */
export const DELETION_GRACE_DAYS = 30;
const MAX_REASON_LENGTH = 500;
const DAY_MS = 86_400_000;

export type DeletionRequestRow = typeof accountDeletionRequest.$inferSelect;
export type DeletionStatus = "none" | "requested" | "cancelled" | "completed";

function cleanReason(reason: string | undefined | null): string | null {
  const trimmed = (reason ?? "").trim();
  return trimmed ? trimmed.slice(0, MAX_REASON_LENGTH) : null;
}

async function findOpen(userId: string): Promise<DeletionRequestRow | null> {
  const rows = await db
    .select()
    .from(accountDeletionRequest)
    .where(and(eq(accountDeletionRequest.billingAccountId, userId), eq(accountDeletionRequest.status, "requested")))
    .limit(1);
  return rows[0] ?? null;
}

/** Creates the request for the person's OWN account; returns the open one if there already is one. */
export async function requestDeletion(input: {
  userId: string;
  reason?: string | null;
  now?: Date;
}): Promise<DeletionRequestRow & { alreadyRequested?: boolean }> {
  const now = input.now ?? new Date();
  const open = await findOpen(input.userId);
  if (open) return { ...open, alreadyRequested: true };

  const row = {
    id: crypto.randomUUID(),
    userId: input.userId,
    billingAccountId: input.userId,
    requestedAt: now,
    scheduledFor: new Date(now.getTime() + DELETION_GRACE_DAYS * DAY_MS),
    status: "requested",
    reason: cleanReason(input.reason),
    cancelledAt: null,
    completedAt: null,
  } satisfies DeletionRequestRow;
  await db.insert(accountDeletionRequest).values(row);
  return row;
}

/** Cancels the open request. Returns null when there was nothing to cancel. */
export async function cancelDeletionRequest(input: {
  userId: string;
  now?: Date;
}): Promise<DeletionRequestRow | null> {
  const now = input.now ?? new Date();
  const rows = await db
    .update(accountDeletionRequest)
    .set({ status: "cancelled", cancelledAt: now })
    .where(and(eq(accountDeletionRequest.billingAccountId, input.userId), eq(accountDeletionRequest.status, "requested")))
    .returning();
  return rows[0] ?? null;
}

export async function getDeletionStatus(
  userId: string,
): Promise<{ status: DeletionStatus; request: DeletionRequestRow | null }> {
  const rows = await db
    .select()
    .from(accountDeletionRequest)
    .where(eq(accountDeletionRequest.billingAccountId, userId))
    .orderBy(desc(accountDeletionRequest.requestedAt))
    .limit(1);
  const request = rows[0] ?? null;
  return { status: (request?.status as DeletionStatus | undefined) ?? "none", request };
}
