// app/api/dashboard/summary+api.ts
// Dashboard summary aggregated with SQL over every invoice (see lib/dashboard/summary.ts).
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { getDashboardSummaryFromDb } from "@/lib/dashboard/summary";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  try {
    const summary = await getDashboardSummaryFromDb(session.user.id);
    return jsonResponse({ summary });
  } catch (error) {
    console.error("[GET /api/dashboard/summary]", error);
    const message = error instanceof Error ? error.message : "Failed to load dashboard summary.";
    return jsonResponse({ error: message }, 500);
  }
}
