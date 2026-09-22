// lib/email/send.ts
// High-level email send helper using SMTP.
import { sanitizeHeaderValue } from "@/lib/email/sanitize";
import { createTransporter, getFromAddress } from "@/lib/email/smtp";

export type EmailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
};

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  attachments?: EmailAttachment[];
  /**
   * From display name shown to the recipient (e.g. "Kovács Anna EV via
   * InvoHub") — the verified SMTP address itself never changes. Sanitized
   * again here (defense in depth) even though callers should already send
   * a sanitized value via lib/email/sender.ts.
   */
  fromName?: string;
  /** Where a reply should land — the issuer's own contact address, not InvoHub. */
  replyTo?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; error?: string }> {
  const transporter = createTransporter();
  if (!transporter) {
    return { ok: false, error: "SMTP not configured. Set SMTP_USER and SMTP_PASS in .env." };
  }

  const fromAddress = getFromAddress();
  const fromName = input.fromName ? sanitizeHeaderValue(input.fromName) : undefined;
  const replyTo = input.replyTo ? sanitizeHeaderValue(input.replyTo) : undefined;

  try {
    await transporter.sendMail({
      // An object form ({name, address}) lets nodemailer handle RFC 5322
      // quoting/encoding itself, rather than hand-building a `"name" <addr>`
      // string — safer, and correctly MIME-encodes non-ASCII display names.
      from: fromName ? { name: fromName, address: fromAddress } : fromAddress,
      replyTo: replyTo || undefined,
      to: input.to,
      cc: input.cc?.length ? input.cc.join(", ") : undefined,
      subject: input.subject,
      html: input.html,
      text: input.text ?? input.html.replace(/<[^>]+>/g, ""),
      attachments: input.attachments?.map((file) => ({
        filename: file.filename,
        content: file.content,
        contentType: file.contentType ?? "application/octet-stream",
      })),
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to send email.";
    // Server-side log only — callers must never surface this raw message to
    // the end user (it can contain SMTP-provider specifics); they show a
    // translated, code-based message instead. This log itself carries no
    // secrets (nodemailer errors don't include the SMTP password).
    console.error("[email] send failed:", message);
    return { ok: false, error: message };
  }
}
