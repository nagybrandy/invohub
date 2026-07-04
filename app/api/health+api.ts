// app/api/health+api.ts
// Public liveness probe for deploy smoke tests and uptime checks.

export async function GET() {
  return Response.json(
    {
      ok: true,
      service: "invohub",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
