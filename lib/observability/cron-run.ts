// lib/observability/cron-run.ts
// Run log for the Vercel crons: every run writes one cron_run row, the public
// health probe reads the last-success timestamps, and a failed/partial run
// triggers (at most one per job per day) an owner alert e-mail.
//
// Contract: nothing in here may change the cron's own response or status, and
// nothing stored/sent contains PII — only fixed codes, error class names,
// Postgres/system codes and integer counts.
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { cronRun } from "@/db/schema";
import { sendEmail } from "@/lib/email/send";
import { describeError, reportError } from "@/lib/observability/report-error";

export const CRON_JOBS = ["reminders", "nav-receipt-report"] as const;
export type CronJob = (typeof CRON_JOBS)[number];
export type CronRunStatus = "success" | "partial" | "failure";

export type CronOutcome = {
  status: CronRunStatus;
  counts: Record<string, number>;
  errorSummary: string | null;
};
export type CronSummarizer = (body: unknown) => CronOutcome;

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export const summarizeReminders: CronSummarizer = (body) => {
  const b = obj(body);
  const counts = { processed: num(b.processed), sent: num(b.sent), failed: num(b.failed) };
  return {
    status: counts.failed > 0 ? "partial" : "success",
    counts,
    errorSummary: counts.failed > 0 ? "item_failures" : null,
  };
};

export const summarizeNavReceipt: CronSummarizer = (body) => {
  const b = obj(body);
  const counts = {
    companiesProcessed: num(b.companiesProcessed),
    submitted: num(b.submitted),
    failed: num(b.failed),
    skipped: num(b.skipped),
    blocked: num(b.blocked),
  };
  return {
    status: counts.failed > 0 ? "partial" : "success",
    counts,
    errorSummary: counts.failed > 0 ? "item_failures" : null,
  };
};

const ALERT_THROTTLE_MS = 24 * 60 * 60 * 1000;

async function sendOwnerAlert(rowId: string, job: CronJob, outcome: CronOutcome, startedAt: Date): Promise<void> {
  const to = process.env.OPS_ALERT_EMAIL?.trim();
  if (!to) return;

  const since = new Date(Date.now() - ALERT_THROTTLE_MS);
  const recent = await db
    .select({ id: cronRun.id })
    .from(cronRun)
    .where(and(eq(cronRun.job, job), isNotNull(cronRun.alertSentAt), gte(cronRun.alertSentAt, since)))
    .limit(1);
  if (recent.length > 0) return;

  const countsLine = Object.entries(outcome.counts).map(([k, v]) => `${k}=${v}`).join(", ") || "-";
  const when = startedAt.toISOString();
  const text =
    `InvoHub cron riasztás / alert\n\n` +
    `Feladat / job: ${job}\nÁllapot / status: ${outcome.status}\nIdőpont / time: ${when}\n` +
    `Hibakód / error code: ${outcome.errorSummary ?? "-"}\nSzámlálók / counts: ${countsLine}\n\n` +
    `HU: A futás hibával vagy részleges sikerrel zárult. Részletek a cron_run táblában és a Vercel logban.\n` +
    `EN: The run finished with a failure or partial success. See the cron_run table and Vercel logs.`;
  const html = `<pre style="font-family:monospace">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`;

  const result = await sendEmail({
    to,
    subject: `[InvoHub] cron ${job}: ${outcome.status}`,
    html,
    text,
  });
  if (result.ok) {
    await db.update(cronRun).set({ alertSentAt: new Date() }).where(eq(cronRun.id, rowId));
  }
}

/**
 * Wraps a cron handler: records one cron_run row for the run and, for a
 * failure/partial run, alerts the owner. Returns the handler's own Response
 * unchanged; rethrows if the handler throws.
 */
export async function withCronRunLog(
  job: CronJob,
  handler: () => Promise<Response>,
  summarize: CronSummarizer,
): Promise<Response> {
  const startedAt = new Date();
  let outcome: CronOutcome;
  let response: Response | undefined;
  let thrown: { error: unknown } | undefined;

  try {
    response = await handler();
    if (response.status >= 500) {
      outcome = { status: "failure", counts: {}, errorSummary: `http_${response.status}` };
    } else {
      let body: unknown = null;
      try {
        body = await response.clone().json();
      } catch {
        body = null;
      }
      outcome = summarize(body);
    }
  } catch (error) {
    thrown = { error };
    const { errorClass, code } = describeError(error);
    outcome = { status: "failure", counts: {}, errorSummary: code ? `${errorClass}:${code}` : errorClass };
  }

  await recordRun(job, startedAt, outcome, thrown?.error);

  if (thrown) throw thrown.error;
  return response as Response;
}

async function recordRun(job: CronJob, startedAt: Date, outcome: CronOutcome, error?: unknown): Promise<void> {
  try {
    if (outcome.status !== "success") {
      reportError(`cron:${job}`, error ?? new Error(outcome.errorSummary ?? "cron_failed"), {
        status: outcome.status,
        summary: outcome.errorSummary ?? "",
      });
    }
    const id = randomUUID();
    await db.insert(cronRun).values({
      id,
      job,
      startedAt,
      finishedAt: new Date(),
      status: outcome.status,
      counts: outcome.counts,
      errorSummary: outcome.errorSummary,
    });
    if (outcome.status !== "success") {
      await sendOwnerAlert(id, job, outcome, startedAt);
    }
  } catch (e) {
    reportError(`cron:${job}:log`, e);
  }
}

export type CronHealthEntry = {
  lastSuccessAt: string | null;
  lastRunAt: string | null;
  lastStatus: CronRunStatus | null;
};

const HEALTH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const HEALTH_TIMEOUT_MS = 2000;

/** Timestamps + status only (the health route is public). null on any DB problem. */
export async function getCronHealth(): Promise<Record<string, CronHealthEntry> | null> {
  try {
    const query = db
      .select({ job: cronRun.job, status: cronRun.status, finishedAt: cronRun.finishedAt })
      .from(cronRun)
      .where(gte(cronRun.startedAt, new Date(Date.now() - HEALTH_WINDOW_MS)))
      .orderBy(desc(cronRun.startedAt))
      .limit(200);
    const rows = await Promise.race([
      query,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), HEALTH_TIMEOUT_MS).unref?.()),
    ]);

    const out: Record<string, CronHealthEntry> = {};
    for (const job of CRON_JOBS) out[job] = { lastSuccessAt: null, lastRunAt: null, lastStatus: null };
    for (const r of rows) {
      const entry = out[r.job];
      if (!entry) continue;
      const at = r.finishedAt.toISOString();
      if (entry.lastRunAt === null) {
        entry.lastRunAt = at;
        entry.lastStatus = r.status as CronRunStatus;
      }
      if (entry.lastSuccessAt === null && r.status === "success") entry.lastSuccessAt = at;
    }
    return out;
  } catch (e) {
    reportError("health:crons", e);
    return null;
  }
}
