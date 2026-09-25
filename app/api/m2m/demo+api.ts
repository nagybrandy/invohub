// app/api/m2m/demo+api.ts
// NAV M2M Adózó snapshot (session auth): the real test-env call when
// M2M_* env vars are configured (owner sets these up once), otherwise the
// in-process demo simulator — always returns a snapshot, zero setup needed.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { isM2mConfigured, M2mConfigError } from "@/lib/m2m/credentials";
import { fetchM2mDemoSnapshot } from "@/lib/m2m/demo-user";
import { parseM2mEnvironment } from "@/lib/m2m/environment";

// Production NAV M2M is out of bounds for this route: the credentials are the
// server's shared M2M_* account, and any signed-in user can choose the
// taxpayer to query. CLAUDE.md: never call NAV production from this repo.
function productionRefused() {
  return parseM2mEnvironment(process.env.M2M_ENV) === "production";
}

import { buildM2mSimulatorSnapshot } from "@/lib/m2m/simulator";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  if (isM2mConfigured() && productionRefused()) {
    return jsonResponse({ error: "The NAV M2M production environment is not enabled on this server." }, 403);
  }

  const url = new URL(request.url);
  const taxpayerId = url.searchParams.get("taxpayerId") ?? undefined;
  const seedParam = url.searchParams.get("seed");
  const seed = seedParam != null ? Number(seedParam) : undefined;
  const normalizedSeed = Number.isFinite(seed) ? seed : undefined;

  if (!isM2mConfigured()) {
    const snapshot = buildM2mSimulatorSnapshot({ taxpayerId, seed: normalizedSeed });
    return jsonResponse({ snapshot, configured: false, mode: "demo" });
  }

  try {
    const snapshot = await fetchM2mDemoSnapshot({ taxpayerId, seed: normalizedSeed });
    return jsonResponse({ snapshot, configured: true, mode: "test" });
  } catch (error) {
    if (error instanceof M2mConfigError) {
      const snapshot = buildM2mSimulatorSnapshot({ taxpayerId, seed: normalizedSeed });
      return jsonResponse({ snapshot, configured: false, mode: "demo" });
    }
    const message = error instanceof Error ? error.message : "M2M demo failed.";
    return jsonResponse({ error: message }, 502);
  }
}
