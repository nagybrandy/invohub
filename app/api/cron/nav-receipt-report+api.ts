// app/api/cron/nav-receipt-report+api.ts
// Auth + delegation only — the actual logic (bounded 3-day Budapest-calendar
// backfill, per-day idempotency, retry-in-place) lives in
// lib/nav-receipt/daily-report-run.ts, mirroring how
// app/api/reminders/run+api.ts delegates to lib/reminders/process.ts.
import { runDailyReceiptReports } from "@/lib/nav-receipt/daily-report-run";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  // Fail closed: without a configured secret, nothing can authenticate this route.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDailyReceiptReports();
  return Response.json(result);
}
