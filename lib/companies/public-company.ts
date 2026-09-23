// lib/companies/public-company.ts
// Pure redaction of NAV secrets for anything a Company gets serialized
// into an API response — kept separate from lib/companies/service.ts
// (which imports the live DB client at module scope) so this stays usable
// with jest.requireActual in tests without needing a live DATABASE_URL.
import type { Company } from "@/lib/companies/service";

/**
 * The shape returned to the client (GET/POST /api/companies): the three
 * NAV secret fields are replaced with plain "is one on file?" booleans
 * instead of the decrypted value. `Company` (with the real decrypted
 * secrets) is for server-side use only — e.g. resolveNavCredentials()
 * building a real NAV request — and must never be serialized straight
 * into an API response.
 */
export type PublicCompany = Omit<
  Company,
  "navTechnicalPassword" | "navXmlSignKey" | "navXmlChangeKey"
> & {
  navTechnicalPasswordSet: boolean;
  navXmlSignKeySet: boolean;
  navXmlChangeKeySet: boolean;
};

export function toPublicCompany(company: Company): PublicCompany {
  const { navTechnicalPassword, navXmlSignKey, navXmlChangeKey, ...rest } = company;
  return {
    ...rest,
    navTechnicalPasswordSet: !!navTechnicalPassword,
    navXmlSignKeySet: !!navXmlSignKey,
    navXmlChangeKeySet: !!navXmlChangeKey,
  };
}

/**
 * Does this company have a usable NAV Online Számla setup? Works on the
 * redacted client-side shape (the secrets arrive as "…Set" booleans), so the
 * composer can default its NAV submission toggle from it — adatszolgáltatás
 * is mandatory for an issued invoice, and a company without credentials
 * would only get a failing submission.
 */
export function isNavConfigured(
  company:
    | (Pick<PublicCompany, "navTechnicalUser"> &
        Partial<Pick<PublicCompany, "navTechnicalPasswordSet" | "navXmlSignKeySet" | "navXmlChangeKeySet">>)
    | null
    | undefined
): boolean {
  if (!company) return false;
  return Boolean(
    company.navTechnicalUser?.trim() &&
      company.navTechnicalPasswordSet &&
      company.navXmlSignKeySet &&
      company.navXmlChangeKeySet
  );
}
