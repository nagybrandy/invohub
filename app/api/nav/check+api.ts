// app/api/nav/check+api.ts
// "Kapcsolat tesztelése" — verifies NAV mode/credentials without submitting
// anything: demo mode pings the simulator, test/production mode performs a
// real tokenExchange.
//
// POST accepts the *currently typed* form values (not yet saved) so a user
// editing NAV settings can test before hitting Save — GET is kept as a
// no-body alias that always checks the persisted company record, for any
// caller that wants that instead.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import type { Company } from "@/lib/companies/service";
import { getCompanyByUserId } from "@/lib/companies/service";
import { getNavClient } from "@/lib/nav/client";
import { isNavEnvironment } from "@/lib/nav/environment";
import { NavCredentialsMissingError, resolveNavCredentials } from "@/lib/nav/resolve-credentials";

type CheckOverrides = {
  navEnvironment?: unknown;
  navTechnicalUser?: unknown;
  navTechnicalPassword?: unknown;
  navXmlSignKey?: unknown;
  navXmlChangeKey?: unknown;
  taxNumber?: unknown;
};

function overrideField(override: unknown, saved: string | undefined): string | undefined {
  if (typeof override === "string" && override.trim()) return override.trim();
  return saved;
}

/** Merges any typed-but-unsaved form values over the persisted company for this one check — never written to the DB. */
function applyOverrides(
  userId: string,
  company: Company | null,
  overrides: CheckOverrides | null
): Company {
  const base: Company =
    company ?? { id: "", userId, name: "", createdAt: "", updatedAt: "" };
  if (!overrides) return base;
  return {
    ...base,
    navEnvironment: isNavEnvironment(overrides.navEnvironment) ? overrides.navEnvironment : base.navEnvironment,
    navTechnicalUser: overrideField(overrides.navTechnicalUser, base.navTechnicalUser),
    navTechnicalPassword: overrideField(overrides.navTechnicalPassword, base.navTechnicalPassword),
    navXmlSignKey: overrideField(overrides.navXmlSignKey, base.navXmlSignKey),
    navXmlChangeKey: overrideField(overrides.navXmlChangeKey, base.navXmlChangeKey),
    taxNumber: overrideField(overrides.taxNumber, base.taxNumber),
  };
}

async function runCheck(company: Company) {
  const mode = company.navEnvironment ?? "demo";
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

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const company = await getCompanyByUserId(session.user.id);
  return runCheck(applyOverrides(session.user.id, company, null));
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  let overrides: CheckOverrides | null = null;
  try {
    const text = await request.text();
    overrides = text ? (JSON.parse(text) as CheckOverrides) : null;
  } catch {
    return jsonResponse({ ok: false, error: "Invalid request body." }, 400);
  }

  const company = await getCompanyByUserId(session.user.id);
  return runCheck(applyOverrides(session.user.id, company, overrides));
}
