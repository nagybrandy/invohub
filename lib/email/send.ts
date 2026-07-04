// lib/email/send.ts
// High-level email send helper using SMTP.
import { createTransporter, getFromAddress } from "@/lib/email/smtp";

export type EmailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string[];
  attachments?: EmailAttachment[];
};

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; error?: string }> {
  const transporter = createTransporter();
  if (!transporter) {
    return { ok: false, error: "SMTP not configured. Set SMTP_USER and SMTP_PASS in .env." };
  }

  try {
    await transporter.sendMail({
      from: getFromAddress(),
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
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to send email.",
    };
  }
}
