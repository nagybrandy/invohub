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
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getNavClient } from "@/lib/nav/client";
import { isEncryptedNavSecret, isMaskedNavSecret } from "@/lib/nav/credentials";
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

/**
 * Like overrideField, for the secret fields. A typed override is plaintext;
 * the saved value is sealed. An echoed mask ("••••") means "use the saved
 * one", and a value that looks sealed is ignored so the request body can
 * never make the server decrypt a ciphertext of the caller's choosing.
 */
function overrideSecretField(override: unknown, saved: string | undefined): string | undefined {
  if (typeof override !== "string") return saved;
  if (isMaskedNavSecret(override) || isEncryptedNavSecret(override.trim())) return saved;
  return overrideField(override, saved);
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
    navTechnicalPassword: overrideSecretField(overrides.navTechnicalPassword, base.navTechnicalPassword),
    navXmlSignKey: overrideSecretField(overrides.navXmlSignKey, base.navXmlSignKey),
    navXmlChangeKey: overrideSecretField(overrides.navXmlChangeKey, base.navXmlChangeKey),
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
    return jsonResponse({ ok: false, mode, error: safeErrorMessage(error, "NAV kapcsolat teszt sikertelen.") }, 502);
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
