// app/api/reminders/run+api.ts
// Manual/cron trigger for payment reminder processing.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { processPaymentReminders } from "@/lib/reminders/process";

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    const result = await processPaymentReminders();
    return jsonResponse(result);
  }

  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const result = await processPaymentReminders(session.user.id);
  return jsonResponse(result);
}
