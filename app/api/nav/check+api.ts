// app/api/nav/check+api.ts
// "Kapcsolat tesztelése" — verifies the current NAV mode/credentials without
// submitting anything: demo mode pings the simulator, test/production mode
// performs a real tokenExchange.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { getCompanyByUserId } from "@/lib/companies/service";
import { getNavClient } from "@/lib/nav/client";
import { NavCredentialsMissingError, resolveNavCredentials } from "@/lib/nav/resolve-credentials";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const company = await getCompanyByUserId(session.user.id);
  const mode = company?.navEnvironment ?? "demo";
  const client = getNavClient(mode);

  if (mode === "demo") {
    await client.tokenExchange(null);
    return jsonResponse({
      ok: true,
      mode,
      message: "A demó NAV szimulátor elérhető — nincs szükség NAV-fiókra.",
    });
  }

  try {
    const credentials = resolveNavCredentials(company);
    const result = await client.tokenExchange(credentials);
    return jsonResponse({
      ok: true,
      mode,
      source: credentials.source,
      message:
        credentials.source === "shared"
          ? "Sikeres kapcsolat a közös InvoHub NAV teszt fiókkal."
          : mode === "production"
            ? "Sikeres kapcsolat az éles NAV környezettel."
            : "Sikeres kapcsolat a NAV teszt környezettel.",
      exchangeTokenPreview: `${result.exchangeToken.slice(0, 6)}…`,
    });
  } catch (error) {
    if (error instanceof NavCredentialsMissingError) {
      return jsonResponse({ ok: false, mode, error: error.message }, 400);
    }
    const message = error instanceof Error ? error.message : "NAV kapcsolat teszt sikertelen.";
    return jsonResponse({ ok: false, mode, error: message }, 502);
  }
}
