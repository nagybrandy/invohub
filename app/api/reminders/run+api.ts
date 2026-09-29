// app/api/reminders/run+api.ts
// Manual (POST, authenticated user) and cron (GET, Vercel cron convention) trigger for
// payment reminder processing.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { processPaymentReminders } from "@/lib/reminders/process";

/**
 * The run isolates per-user and per-invoice failures itself and reports them
 * in `failed`/`errors` with a 200 — one permanently undeliverable address
 * must not mark every nightly cron job as failed. Only a run that could not
 * happen at all (e.g. the schedule query itself fails) answers 500, which is
 * the signal Vercel retries on.
 */
async function runReminders(userId?: string): Promise<Response> {
  try {
    // Call it argument-free for a whole-instance run: `undefined` and "no
    // argument" mean the same thing to the function, but only the latter
    // reads as "every user" at the call site.
    const result = userId === undefined
      ? await processPaymentReminders()
      : await processPaymentReminders(userId);
    return jsonResponse(result);
  } catch (e) {
    const message = e instanceof Error && e.message ? e.message : "Unknown error";
    console.error(`[reminders] run failed: ${message}`);
    return jsonResponse({ error: message }, 500);
  }
}

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

  return runReminders();
}

export async function POST(request: Request) {
  if (isAuthorizedCronRequest(request)) {
    return runReminders();
  }

  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  return runReminders(session.user.id);
}
