// lib/workspaces/invite-email.ts
// The e-mail that invites someone into a billing account. Pure.
import type { InvitableRole } from "@/lib/workspaces/permissions";

const ROLE_HU: Record<InvitableRole, string> = {
  admin: "adminisztrátor",
  accountant: "könyvelő",
  viewer: "megtekintő (csak olvasás)",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildInviteEmail(input: {
  url: string;
  accountName: string;
  inviterName?: string | null;
  role: InvitableRole;
  expiresInDays: number;
}): { subject: string; html: string; text: string } {
  const who = input.inviterName?.trim() || "Egy InvoHub-felhasználó";
  const account = input.accountName.trim() || "számlázófiók";
  const role = ROLE_HU[input.role];
  const subject = `InvoHub – meghívó: ${account}`;
  const text = [
    "Üdvözlünk!",
    "",
    `${who} meghívott az InvoHub „${account}” számlázófiókjába, ${role} jogosultsággal.`,
    `Az alábbi linken fogadhatod el (${input.expiresInDays} napig érvényes, és csak ezzel az e-mail-címmel jelentkezhetsz be hozzá):`,
    input.url,
    "",
    "Ha nem számítottál erre a meghívóra, nyugodtan hagyd figyelmen kívül.",
    "",
    "InvoHub",
  ].join("\n");
  const html = `<p>Üdvözlünk!</p>
<p>${escapeHtml(who)} meghívott az InvoHub „${escapeHtml(account)}” számlázófiókjába, <strong>${escapeHtml(role)}</strong> jogosultsággal.</p>
<p><a href="${escapeHtml(input.url)}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px">Meghívó elfogadása</a></p>
<p style="color:#6b7280;font-size:13px">A link ${input.expiresInDays} napig érvényes, és csak ezzel az e-mail-címmel jelentkezhetsz be hozzá. Ha a gomb nem működik, másold a böngészőbe: ${escapeHtml(input.url)}</p>
<p>Ha nem számítottál erre a meghívóra, nyugodtan hagyd figyelmen kívül.</p>
<p>InvoHub</p>`;
  return { subject, html, text };
}
