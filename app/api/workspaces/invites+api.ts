// app/api/workspaces/invites+api.ts
// Invite someone (an accountant, a colleague) into the CURRENT billing
// account by e-mail, and list the pending invitations. Owner/admin only
// (enforced centrally). The link is e-mailed and also returned to the
// inviting admin, so it can be shared another way if the mail does not arrive.
import { jsonResponse, requireActor, requireSession, sessionRole, unauthorizedResponse } from "@/lib/api/session";
import { sendEmail } from "@/lib/email/send";
import { buildInviteEmail } from "@/lib/workspaces/invite-email";
import { INVITE_TTL_DAYS, isPlausibleEmail } from "@/lib/workspaces/invites";
import { canManageAdmins, isInvitableRole } from "@/lib/workspaces/permissions";
import { sanitizeHeaderValue } from "@/lib/email/sanitize";
import { InviteLimitError, createInvite, listPendingInvites } from "@/lib/workspaces/service";
import { db } from "@/db";
import { company, user } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();
  return jsonResponse({ invites: await listPendingInvites(session.user.id) });
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();
  const actor = await requireActor(request);

  const body = (await request.json().catch(() => ({}))) as { email?: unknown; role?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!isPlausibleEmail(email)) return jsonResponse({ error: "A valid e-mail address is required.", code: "invalidEmail" }, 400);
  if (!isInvitableRole(body.role)) return jsonResponse({ error: "A valid role is required.", code: "invalidRole" }, 400);
  if (actor && email.toLowerCase() === actor.user.email.toLowerCase()) {
    return jsonResponse({ error: "You cannot invite yourself.", code: "selfInvite" }, 400);
  }

  // The administrator role is the owner's to give.
  if (body.role === "admin" && !canManageAdmins(sessionRole(session))) {
    return jsonResponse({ error: "Only the owner may invite an administrator.", code: "adminOnly" }, 403);
  }

  let created;
  try {
    created = await createInvite({
      accountId: session.user.id,
      email,
      role: body.role,
      invitedBy: actor?.user.id ?? session.user.id,
    });
  } catch (error) {
    if (error instanceof InviteLimitError) return jsonResponse({ error: "Too many pending invitations.", code: "inviteLimit" }, 429);
    throw error;
  }
  const { invite, token } = created;

  // The link goes out under the CONFIGURED app address when there is one — the
  // request's Host header is attacker-influenced and must not decide where an
  // e-mailed link points.
  const origin = (process.env.BETTER_AUTH_URL?.trim() || "").replace(/\/+$/, "") || new URL(request.url).origin;
  const url = `${origin}/invite?token=${encodeURIComponent(token)}`;
  const [co] = await db.select({ name: company.name }).from(company).where(eq(company.userId, session.user.id));
  const [acct] = await db.select({ name: user.name }).from(user).where(eq(user.id, session.user.id));
  const mail = buildInviteEmail({
    url,
    accountName: co?.name || acct?.name || "",
    inviterName: actor?.user.name,
    role: body.role,
    expiresInDays: INVITE_TTL_DAYS,
  });
  const sent = await sendEmail({ to: invite.email, subject: sanitizeHeaderValue(mail.subject), html: mail.html, text: mail.text });

  return jsonResponse({ invite, inviteUrl: url, emailSent: sent.ok }, 201);
}
