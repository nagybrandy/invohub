// lib/workspaces/invites.ts
// Pure rules for invitations: token hashing and "may this person accept this
// invite now?". The database work is in lib/workspaces/service.ts.
import { createHash } from "node:crypto";
import { createSecureToken } from "@/lib/id";
import type { InvitableRole } from "@/lib/workspaces/permissions";

/** A pending invitation is valid for 14 days. */
export const INVITE_TTL_DAYS = 14;

/** A fresh token for the e-mailed link; only its hash is stored. */
export function newInviteToken(): { token: string; tokenHash: string } {
  const token = createSecureToken();
  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function inviteExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Loose, deliberate: real validation is the e-mail arriving. */
export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) && email.length <= 254;
}

export type InviteRow = {
  email: string;
  role: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

export type InviteVerdict =
  | { ok: true; role: InvitableRole }
  | { ok: false; reason: "notFound" | "revoked" | "alreadyAccepted" | "expired" | "wrongEmail" | "invalidRole" };

/**
 * The invitation is addressed to one e-mail: whoever opens the link must be
 * signed in with that address, so a forwarded link grants nothing.
 */
export function evaluateInvite(invite: InviteRow | null, acceptingEmail: string, now: Date): InviteVerdict {
  if (!invite) return { ok: false, reason: "notFound" };
  if (invite.revokedAt) return { ok: false, reason: "revoked" };
  if (invite.acceptedAt) return { ok: false, reason: "alreadyAccepted" };
  if (invite.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  if (normalizeInviteEmail(invite.email) !== normalizeInviteEmail(acceptingEmail)) return { ok: false, reason: "wrongEmail" };
  if (invite.role !== "admin" && invite.role !== "accountant" && invite.role !== "viewer") return { ok: false, reason: "invalidRole" };
  return { ok: true, role: invite.role };
}
