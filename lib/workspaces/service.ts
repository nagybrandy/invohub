// lib/workspaces/service.ts
// Billing accounts ("workspaces") and who may work in them.
//
// Every business table is keyed by user id, so a workspace is simply a user
// row that cannot sign in (kind = "workspace", no credential `account`). A
// person works in it through a workspace_access row; requireSession
// (lib/api/session.ts) then points `session.user.id` at the workspace, which
// scopes all 50+ routes at once.
import { and, desc, eq, gt, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { company, user, workspaceAccess, workspaceInvite } from "@/db/schema";
import { seedDefaultTemplates } from "@/lib/email/templates/service";
import { createId } from "@/lib/id";
import {
  evaluateInvite,
  hashInviteToken,
  inviteExpiry,
  newInviteToken,
  normalizeInviteEmail,
  type InviteVerdict,
} from "@/lib/workspaces/invites";
import { type InvitableRole, type WorkspaceRole, isWorkspaceRole } from "@/lib/workspaces/permissions";

export const MAX_WORKSPACES_PER_PERSON = 10;

export type AccountSummary = {
  id: string;
  name: string;
  kind: "person" | "workspace";
  role: WorkspaceRole;
  /** This person's own login account. */
  isOwn: boolean;
};

/** The person's role in an account, or null when they have no access. */
export async function getAccountRole(personId: string, accountId: string): Promise<{ role: WorkspaceRole; name: string; kind: string } | null> {
  const [acct] = await db
    .select({ id: user.id, name: user.name, kind: user.kind, closedAt: user.closedAt })
    .from(user)
    .where(eq(user.id, accountId));
  if (!acct || acct.closedAt) return null;
  if (acct.id === personId) return { role: "owner", name: acct.name, kind: acct.kind };
  const [row] = await db
    .select({ role: workspaceAccess.role })
    .from(workspaceAccess)
    .where(and(eq(workspaceAccess.accountUserId, accountId), eq(workspaceAccess.granteeUserId, personId)));
  if (!row || !isWorkspaceRole(row.role)) return null;
  return { role: row.role, name: acct.name, kind: acct.kind };
}

/** The person's own account first, then every account they were given access to. */
export async function listAccounts(person: { id: string; name: string }): Promise<AccountSummary[]> {
  const rows = await db
    .select({ id: user.id, name: user.name, kind: user.kind, role: workspaceAccess.role, closedAt: user.closedAt })
    .from(workspaceAccess)
    .innerJoin(user, eq(user.id, workspaceAccess.accountUserId))
    .where(eq(workspaceAccess.granteeUserId, person.id));

  const ids = rows.map((r) => r.id);
  const companies = ids.length
    ? await db.select({ userId: company.userId, name: company.name }).from(company).where(inArray(company.userId, ids))
    : [];
  const companyName = new Map(companies.map((c) => [c.userId, c.name]));

  const own: AccountSummary = { id: person.id, name: person.name, kind: "person", role: "owner", isOwn: true };
  const others = rows
    .filter((r) => !r.closedAt && isWorkspaceRole(r.role))
    .map<AccountSummary>((r) => ({
      id: r.id,
      name: companyName.get(r.id) || r.name,
      kind: r.kind === "workspace" ? "workspace" : "person",
      role: r.role as WorkspaceRole,
      isOwn: false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [own, ...others];
}

export class WorkspaceLimitError extends Error {
  readonly code = "workspaceLimit";
}

/** Creates a billing account owned by `ownerId`. */
export async function createWorkspace(ownerId: string, name: string): Promise<{ id: string; name: string }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Workspace name is required.");

  const owned = await db
    .select({ id: workspaceAccess.id })
    .from(workspaceAccess)
    .innerJoin(user, eq(user.id, workspaceAccess.accountUserId))
    .where(and(eq(workspaceAccess.granteeUserId, ownerId), eq(workspaceAccess.role, "owner"), eq(user.kind, "workspace")));
  if (owned.length >= MAX_WORKSPACES_PER_PERSON) throw new WorkspaceLimitError("Too many billing accounts.");

  const id = createId();
  const now = new Date();
  await db.insert(user).values({
    id,
    name: trimmed,
    // Never a real mailbox and never a login: there is no credential row for it.
    email: `workspace+${id}@workspace.invohub.invalid`,
    emailVerified: true,
    role: "entrepreneur",
    signupRole: "entrepreneur",
    kind: "workspace",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(workspaceAccess).values({ id: createId(), accountUserId: id, granteeUserId: ownerId, role: "owner", invitedByUserId: ownerId, createdAt: now });
  await db.insert(company).values({ id: createId(), userId: id, name: trimmed, country: "HU", createdAt: now, updatedAt: now });
  await seedDefaultTemplates(id);
  return { id, name: trimmed };
}

export type MemberRow = { accessId: string; userId: string; name: string; email: string; role: WorkspaceRole; isYou: boolean };

export async function listMembers(accountId: string, viewerId: string): Promise<MemberRow[]> {
  const rows = await db
    .select({ accessId: workspaceAccess.id, userId: user.id, name: user.name, email: user.email, role: workspaceAccess.role })
    .from(workspaceAccess)
    .innerJoin(user, eq(user.id, workspaceAccess.granteeUserId))
    .where(eq(workspaceAccess.accountUserId, accountId))
    .orderBy(workspaceAccess.createdAt);
  return rows
    .filter((r) => isWorkspaceRole(r.role))
    .map((r) => ({ ...r, role: r.role as WorkspaceRole, isYou: r.userId === viewerId }));
}

export class AdminOnlyError extends Error {
  readonly code = "adminOnly";
}

export class LastOwnerError extends Error {
  readonly code = "lastOwner";
}

/** Removes (or lets leave) a member. The account's last owner can never be removed. */
export async function removeMember(accountId: string, accessId: string, actorRole: WorkspaceRole = "owner"): Promise<boolean> {
  const [row] = await db
    .select({ id: workspaceAccess.id, role: workspaceAccess.role })
    .from(workspaceAccess)
    .where(and(eq(workspaceAccess.id, accessId), eq(workspaceAccess.accountUserId, accountId)));
  if (!row) return false;
  if (row.role === "owner") throw new LastOwnerError("The owner cannot be removed.");
  if (row.role === "admin" && actorRole !== "owner") throw new AdminOnlyError("Only the owner may remove an administrator.");
  await db.delete(workspaceAccess).where(eq(workspaceAccess.id, accessId));
  return true;
}

export async function changeMemberRole(accountId: string, accessId: string, role: InvitableRole, actorRole: WorkspaceRole = "owner"): Promise<boolean> {
  const [row] = await db
    .select({ id: workspaceAccess.id, role: workspaceAccess.role })
    .from(workspaceAccess)
    .where(and(eq(workspaceAccess.id, accessId), eq(workspaceAccess.accountUserId, accountId)));
  if (!row) return false;
  if (row.role === "owner") throw new LastOwnerError("The owner's role cannot be changed.");
  // The administrator role is the owner's to give and take.
  if ((row.role === "admin" || role === "admin") && actorRole !== "owner") throw new AdminOnlyError("Only the owner may manage administrators.");
  await db.update(workspaceAccess).set({ role }).where(eq(workspaceAccess.id, accessId));
  return true;
}

/** Pending invitations per account — keeps the invite e-mail from being used as a mail relay. */
export const MAX_PENDING_INVITES = 20;

export class InviteLimitError extends Error {
  readonly code = "inviteLimit";
}

export type InviteSummary = { id: string; email: string; role: string; expiresAt: string; createdAt: string };

export async function createInvite(input: { accountId: string; email: string; role: InvitableRole; invitedBy: string; now?: Date }): Promise<{ invite: InviteSummary; token: string }> {
  const now = input.now ?? new Date();
  const email = normalizeInviteEmail(input.email);
  const pending = await listPendingInvites(input.accountId, now);
  // A re-invite of an address that already has a live invite replaces it, so it does not count against the cap.
  if (pending.filter((p) => p.email !== email).length >= MAX_PENDING_INVITES) throw new InviteLimitError("Too many pending invitations.");
  const { token, tokenHash } = newInviteToken();
  const id = createId();
  const expiresAt = inviteExpiry(now);
  // One live invitation per e-mail and account: a new one replaces the old.
  await db
    .update(workspaceInvite)
    .set({ revokedAt: now })
    .where(and(eq(workspaceInvite.accountUserId, input.accountId), eq(workspaceInvite.email, email), isNull(workspaceInvite.acceptedAt), isNull(workspaceInvite.revokedAt)));
  await db.insert(workspaceInvite).values({ id, accountUserId: input.accountId, email, role: input.role, tokenHash, invitedByUserId: input.invitedBy, expiresAt, createdAt: now });
  return { invite: { id, email, role: input.role, expiresAt: expiresAt.toISOString(), createdAt: now.toISOString() }, token };
}

export async function listPendingInvites(accountId: string, now: Date = new Date()): Promise<InviteSummary[]> {
  const rows = await db
    .select()
    .from(workspaceInvite)
    .where(and(eq(workspaceInvite.accountUserId, accountId), isNull(workspaceInvite.acceptedAt), isNull(workspaceInvite.revokedAt)))
    .orderBy(desc(workspaceInvite.createdAt));
  return rows
    .filter((r) => r.expiresAt.getTime() > now.getTime())
    .map((r) => ({ id: r.id, email: r.email, role: r.role, expiresAt: r.expiresAt.toISOString(), createdAt: r.createdAt.toISOString() }));
}

export async function revokeInvite(accountId: string, inviteId: string, now: Date = new Date()): Promise<boolean> {
  const rows = await db
    .update(workspaceInvite)
    .set({ revokedAt: now })
    .where(and(eq(workspaceInvite.id, inviteId), eq(workspaceInvite.accountUserId, accountId), isNull(workspaceInvite.acceptedAt), isNull(workspaceInvite.revokedAt)))
    .returning({ id: workspaceInvite.id });
  return rows.length > 0;
}

export type AcceptResult = { ok: true; accountId: string; accountName: string; role: InvitableRole } | { ok: false; reason: Exclude<InviteVerdict, { ok: true }>["reason"] };

/**
 * Accepts an invitation for the signed-in person.
 * Order matters: everything that could refuse it runs BEFORE the invitation is
 * claimed, and the claim itself is one conditional UPDATE — two concurrent
 * accepts cannot both win, and a revoked/expired invite cannot be claimed.
 */
export async function acceptInvite(token: string, person: { id: string; email: string }, now: Date = new Date()): Promise<AcceptResult> {
  const [invite] = await db.select().from(workspaceInvite).where(eq(workspaceInvite.tokenHash, hashInviteToken(token)));
  const verdict = evaluateInvite(invite ?? null, person.email, now);
  if (!verdict.ok) return verdict;

  // The person already owns this very account (invited to their own account): nothing to grant.
  if (invite.accountUserId === person.id) return { ok: false, reason: "invalidRole" };

  // The invitation is only as good as the inviter's rights NOW: someone demoted,
  // removed — or an account closed — since sending it cannot hand out access.
  const inviterRole = invite.invitedByUserId ? await getAccountRole(invite.invitedByUserId, invite.accountUserId) : null;
  if (!inviterRole || (inviterRole.role !== "owner" && inviterRole.role !== "admin")) return { ok: false, reason: "revoked" };
  // Only the owner may hand out the administrator role.
  if (verdict.role === "admin" && inviterRole.role !== "owner") return { ok: false, reason: "revoked" };

  const claimed = await db
    .update(workspaceInvite)
    .set({ acceptedAt: now })
    .where(and(eq(workspaceInvite.id, invite.id), isNull(workspaceInvite.acceptedAt), isNull(workspaceInvite.revokedAt), gt(workspaceInvite.expiresAt, now)))
    .returning({ id: workspaceInvite.id });
  if (claimed.length === 0) return { ok: false, reason: "alreadyAccepted" };

  const [existing] = await db
    .select({ id: workspaceAccess.id, role: workspaceAccess.role })
    .from(workspaceAccess)
    .where(and(eq(workspaceAccess.accountUserId, invite.accountUserId), eq(workspaceAccess.granteeUserId, person.id)));
  if (existing) {
    // Never downgrade an owner through an invitation; otherwise take the invited role.
    if (existing.role !== "owner") await db.update(workspaceAccess).set({ role: verdict.role }).where(eq(workspaceAccess.id, existing.id));
  } else {
    await db.insert(workspaceAccess).values({ id: createId(), accountUserId: invite.accountUserId, granteeUserId: person.id, role: verdict.role, invitedByUserId: invite.invitedByUserId, createdAt: now });
  }

  const [co] = await db.select({ name: company.name }).from(company).where(eq(company.userId, invite.accountUserId));
  return { ok: true, accountId: invite.accountUserId, accountName: co?.name || inviterRole.name || "", role: verdict.role };
}
/** A person gives up their own access to an account. The owner cannot leave their own account. */
export async function leaveAccount(personId: string, accountId: string): Promise<boolean> {
  const rows = await db
    .delete(workspaceAccess)
    .where(and(eq(workspaceAccess.accountUserId, accountId), eq(workspaceAccess.granteeUserId, personId), ne(workspaceAccess.role, "owner")))
    .returning({ id: workspaceAccess.id });
  return rows.length > 0;
}
