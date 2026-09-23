// app/api/m2m/check+api.ts
// "Kapcsolat tesztelése" for M2M: demo mode always succeeds (simulator),
// configured mode performs a real token + nonce exchange only.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { createM2mSession } from "@/lib/m2m/auth";
import { isM2mConfigured, loadM2mCredentialsFromEnv, M2mConfigError } from "@/lib/m2m/credentials";
import { parseM2mEnvironment } from "@/lib/m2m/environment";

// Production NAV M2M is out of bounds for this route: the credentials are the
// server's shared M2M_* account, and any signed-in user can choose the
// taxpayer to query. CLAUDE.md: never call NAV production from this repo.
function productionRefused() {
  return parseM2mEnvironment(process.env.M2M_ENV) === "production";
}


export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  if (isM2mConfigured() && productionRefused()) {
    return jsonResponse({ error: "A NAV M2M éles környezet ezen a szerveren nem engedélyezett." }, 403);
  }

  if (!isM2mConfigured()) {
    return jsonResponse({
      ok: true,
      mode: "demo",
      message: "A demó NAV M2M szimulátor elérhető — nincs szükség fiókra.",
    });
  }

  try {
    const credentials = loadM2mCredentialsFromEnv();
    await createM2mSession(credentials);
    return jsonResponse({
      ok: true,
      mode: "test",
      message: "Sikeres kapcsolat a NAV M2M teszt környezettel.",
    });
  } catch (error) {
    if (error instanceof M2mConfigError) {
      return jsonResponse({ ok: false, mode: "test", error: error.message }, 400);
    }
    const message = error instanceof Error ? error.message : "M2M kapcsolat teszt sikertelen.";
    return jsonResponse({ ok: false, mode: "test", error: message }, 502);
  }
}
