// app/api/reminders/run+api.ts
// Manual (POST, authenticated user) and cron (GET, Vercel cron convention) trigger for
// payment reminder processing.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { processPaymentReminders } from "@/lib/reminders/process";
import { generateDueDrafts } from "@/lib/recurring/service";

function errorMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Unknown error";
}

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
    const message = errorMessage(e);
    console.error(`[reminders] run failed: ${message}`);
    return jsonResponse({ error: message }, 500);
  }
}

/**
 * The whole-instance daily run: payment reminders AND recurring-invoice
 * draft generation. Recurring templates ride on this existing cron instead of
 * a third `crons` entry in vercel.json (the plan may cap cron jobs). The two
 * are isolated — each has its own try/catch, so a failure in one never
 * breaks the other — and both results are in the JSON body.
 *
 * Status: unchanged for reminders (500 only if the reminder run could not
 * happen at all, so Vercel retries). A recurring failure is reported in
 * `recurring.error` with the reminders' status — retrying the whole cron
 * would re-run reminders, and generation is idempotent and retried by the
 * next daily tick anyway.
 *
 * Recurring generation creates DRAFTS ONLY. Auto-issuing needs explicit owner
 * sign-off (see lib/recurring/service.ts).
 */
async function runDaily(): Promise<Response> {
  const remindersResponse = await runReminders();

  let recurring: unknown;
  try {
    recurring = await generateDueDrafts();
  } catch (e) {
    const message = errorMessage(e);
    console.error(`[recurring] run failed: ${message}`);
    recurring = { error: message };
  }

  const reminders = (await remindersResponse.json()) as Record<string, unknown>;
  return jsonResponse({ ...reminders, recurring }, remindersResponse.status);
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

  return runDaily();
}

export async function POST(request: Request) {
  if (isAuthorizedCronRequest(request)) {
    return runDaily();
  }

  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  return runReminders(session.user.id);
}
