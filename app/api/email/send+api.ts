// app/api/email/send+api.ts
// Auth-gated email send endpoint (server-side only).
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { sendEmail } from "@/lib/email/send";

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as {
    to?: string;
    subject?: string;
    html?: string;
    text?: string;
  };

  if (!body.to || !body.subject || !body.html) {
    return jsonResponse({ error: "to, subject, and html are required." }, 400);
  }

  const result = await sendEmail({
    to: body.to,
    subject: body.subject,
    html: body.html,
    text: body.text,
  });

  if (!result.ok) {
    return jsonResponse({ error: result.error }, 500);
  }

  return jsonResponse({ ok: true });
}
