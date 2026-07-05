// app/api/companies+api.ts
// Company profile GET and upsert.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { getCompanyByUserId, upsertCompany } from "@/lib/companies/service";
import type { CompanyInput } from "@/lib/companies/service";
import { isNavEnvironment } from "@/lib/nav/environment";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const company = await getCompanyByUserId(session.user.id);
  return jsonResponse({ company });
}

export async function POST(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const body = (await request.json()) as CompanyInput;
  if (!body.name?.trim()) {
    return jsonResponse({ error: "Company name is required." }, 400);
  }
  if (body.navEnvironment !== undefined && !isNavEnvironment(body.navEnvironment)) {
    return jsonResponse({ error: "navEnvironment must be test or production." }, 400);
  }

  const company = await upsertCompany(session.user.id, body);
  return jsonResponse({ company });
}

export async function PATCH(request: Request) {
  return POST(request);
}
