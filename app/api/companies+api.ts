// app/api/companies+api.ts
// Company profile GET and upsert.
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
    console.error("[GET /api/companies]", error);
    const message = error instanceof Error ? error.message : "Failed to load company profile.";
    return jsonResponse({ error: message }, 500);
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
    console.error("[POST /api/companies]", error);
    const message = error instanceof Error ? error.message : "Failed to save company profile.";
    return jsonResponse({ error: message }, 500);
  }
}

export async function PATCH(request: Request) {
  return POST(request);
}
