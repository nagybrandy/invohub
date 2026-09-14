// app/api/company/lookup+api.ts
// Lookup company data by tax number — real NAV queryTaxpayer in test/
// production mode with credentials, deterministic demo taxpayers otherwise.
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { getCompanyByUserId } from "@/lib/companies/service";
import { lookupCompanyByTaxNumber } from "@/lib/company/lookup";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const url = new URL(request.url);
  const taxNumber = url.searchParams.get("taxNumber");
  if (!taxNumber) {
    return jsonResponse({ error: "taxNumber query param required." }, 400);
  }

  const company = await getCompanyByUserId(session.user.id);
  const result = await lookupCompanyByTaxNumber(taxNumber, company);
  return jsonResponse({ company: result });
}
