// app/api/company/lookup+api.ts
// Lookup company data by tax number (stub).
import { jsonResponse, requireSession, unauthorizedResponse } from "@/lib/api/session";
import { lookupCompanyByTaxNumber } from "@/lib/company/lookup";

export async function GET(request: Request) {
  const session = await requireSession(request);
  if (!session) return unauthorizedResponse();

  const url = new URL(request.url);
  const taxNumber = url.searchParams.get("taxNumber");
  if (!taxNumber) {
    return jsonResponse({ error: "taxNumber query param required." }, 400);
  }

  const result = await lookupCompanyByTaxNumber(taxNumber);
  return jsonResponse({ company: result });
}
