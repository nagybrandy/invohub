// app/api/companies+api.ts
// Company profile GET and upsert.
import { logSafeError, safeErrorMessage } from "@/lib/api/safe-error";
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { getCompanyByUserId, upsertCompany } from "@/lib/companies/service";
import type { CompanyInput } from "@/lib/companies/service";
import { toPublicCompany } from "@/lib/companies/public-company";
import { isNavEnvironment } from "@/lib/nav/environment";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  try {
    const company = await getCompanyByUserId(session.user.id);
    // Never the raw Company: it carries decrypted NAV secrets, and this
    // response is what lands in the browser (network tab, DOM, etc).
    return jsonResponse({ company: company ? toPublicCompany(company) : null });
  } catch (error) {
    logSafeError("[GET /api/companies]", error);
    return jsonResponse({ error: safeErrorMessage(error, "Failed to load company profile.") }, 500);
  }
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  try {
    const body = (await request.json()) as CompanyInput;
    if (!body.name?.trim()) {
      return jsonResponse({ error: "Company name is required." }, 400);
    }
    if (body.navEnvironment !== undefined && !isNavEnvironment(body.navEnvironment)) {
      return jsonResponse({ error: "navEnvironment must be test or production." }, 400);
    }

    const company = await upsertCompany(session.user.id, body);
    return jsonResponse({ company: toPublicCompany(company) });
  } catch (error) {
    // Never the raw error: a failed UPDATE carries the bound params (sealed
    // secrets) in its message/cause.
    logSafeError("[POST /api/companies]", error);
    return jsonResponse({ error: safeErrorMessage(error, "Failed to save company profile.") }, 500);
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}
