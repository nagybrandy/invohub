// lib/email/sender.ts
// Resolves the "sender identity" — From display name + Reply-To — used for
// every e-mail InvoHub sends on a user's behalf to their own customers
// (invoice notifications, payment reminders, receipts). The message still
// goes out from InvoHub's verified SMTP address (SPF/DKIM stay valid), but
// the From display name carries the issuer's company name and Reply-To
// points at an address the issuer actually reads — so a customer who hits
// "reply" reaches the issuer, not InvoHub. See AGENTS.md / CLAUDE.md.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getCompanyByUserId, type Company } from "@/lib/companies/service";
import { sanitizeHeaderValue } from "@/lib/email/sanitize";

export type SenderIdentity = {
  /** From display name, e.g. "Kovács Anna EV via InvoHub" — the verified SMTP address itself is unchanged. */
  fromName: string;
  /** Where a customer's reply should land — the issuer's own contact, never InvoHub. Undefined only if it truly can't be resolved. */
  replyTo?: string;
};

async function resolveIssuerContactEmail(userId: string): Promise<string | undefined> {
  // The company profile has no dedicated contact-email field today (see the
  // `company` table in db/schema.ts) — fall back to the account owner's own
  // login e-mail, so a customer's reply still reaches a real person instead
  // of disappearing into InvoHub's inbox.
  const [row] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row?.email ?? undefined;
}

export async function resolveSenderIdentity(
  userId: string,
  preloadedCompany?: Company | null
): Promise<SenderIdentity> {
  const company = preloadedCompany !== undefined ? preloadedCompany : await getCompanyByUserId(userId);
  const companyName = company?.name?.trim();
  const fromName = sanitizeHeaderValue(companyName ? `${companyName} via InvoHub` : "InvoHub");

  const contactEmail = await resolveIssuerContactEmail(userId);
  const replyTo = contactEmail ? sanitizeHeaderValue(contactEmail) : undefined;

  return { fromName, replyTo: replyTo || undefined };
}
