// app/api/health+api.ts
// Public liveness probe for deploy smoke tests and uptime checks. Also exposes
// when each cron last ran / succeeded (timestamps + status only — this route
// is public, so no counts, error codes or tenant data).
import { getCronHealth } from "@/lib/observability/cron-run";

export async function GET() {
  let crons: Awaited<ReturnType<typeof getCronHealth>> = null;
  try {
    crons = await getCronHealth();
  } catch {
    crons = null;
  }

  return Response.json(
    {
      ok: true,
      service: "invohub",
      timestamp: new Date().toISOString(),
      crons,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
