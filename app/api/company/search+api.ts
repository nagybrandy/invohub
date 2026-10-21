// app/api/company/search+api.ts
// Partner search among Hungarian companies for the invoice composer:
// adószám → NAV, name → configured registry provider (see lib/company/search.ts).
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { getCompanyByUserId } from "@/lib/companies/service";
import { searchHungarianCompanies } from "@/lib/company/search";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return jsonResponse({ results: [], provider: "nav-only" });

  const company = await getCompanyByUserId(session.user.id);
  return jsonResponse(await searchHungarianCompanies(q, company));
}
