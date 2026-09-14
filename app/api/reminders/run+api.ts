// app/api/reminders/run+api.ts
// Manual (POST, authenticated user) and cron (GET, Vercel cron convention) trigger for
// payment reminder processing.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { processPaymentReminders } from "@/lib/reminders/process";

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

// Vercel cron sends `Authorization: Bearer $CRON_SECRET` on every scheduled GET request.
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return unauthorizedResponse();
  }

  const result = await processPaymentReminders();
  return jsonResponse(result);
}

export async function POST(request: Request) {
  if (isAuthorizedCronRequest(request)) {
    const result = await processPaymentReminders();
    return jsonResponse(result);
  }

  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const result = await processPaymentReminders(session.user.id);
  return jsonResponse(result);
}
