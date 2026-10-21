// lib/company/lookup-server.ts
// The lookup wired to the real company_directory cache — what the API routes
// call. (lookup.ts itself stays database-free so its tests don't need @/db.)
import type { Company } from "@/lib/companies/service";
import { companyDirectory } from "@/lib/company/directory";
import { lookupCompanyByTaxNumber, type CompanyLookupResult } from "@/lib/company/lookup";

export function lookupCompanyCached(taxNumber: string, company?: Company | null): Promise<CompanyLookupResult | null> {
  return lookupCompanyByTaxNumber(taxNumber, company, { directory: companyDirectory });
}
