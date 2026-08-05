// app/api/m2m/demo+api.ts
// Live NAV M2M demo — random official test taxpayer snapshot (session auth).
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { isM2mConfigured, M2mConfigError } from "@/lib/m2m/credentials";
import { fetchM2mDemoSnapshot } from "@/lib/m2m/demo-user";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  if (!isM2mConfigured()) {
    return jsonResponse(
      {
        error: "M2M not configured.",
        hint: "Add M2M_* variables to .env (see .env.example).",
      },
      503
    );
  }

  const url = new URL(request.url);
  const taxpayerId = url.searchParams.get("taxpayerId") ?? undefined;
  const seedParam = url.searchParams.get("seed");
  const seed = seedParam != null ? Number(seedParam) : undefined;

  try {
    const snapshot = await fetchM2mDemoSnapshot({
      taxpayerId,
      seed: Number.isFinite(seed) ? seed : undefined,
    });
    return jsonResponse({ snapshot, configured: true });
  } catch (error) {
    if (error instanceof M2mConfigError) {
      return jsonResponse({ error: error.message }, 503);
    }
    const message = error instanceof Error ? error.message : "M2M demo failed.";
    return jsonResponse({ error: message }, 502);
  }
}
