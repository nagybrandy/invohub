// lib/companies/completeness.ts
// Pure "is this company profile ready to issue an invoice" check — no DB
// import, so it's usable both server-side (lib/invoices/service.ts's
// numbering path) and client-side (the composer's finalize-gate banner,
// login.tsx's post-auth redirect) without pulling in @/db.
//
// A finalized (numbered) invoice is a legal document under Áfa tv. 169. §
// and must carry the seller's name, tax number and full address — so
// finalizing (assigning a real invoiceNumber) is refused until these five
// fields are filled in. Nothing else on the company profile is required.
export const COMPANY_PROFILE_REQUIRED_FIELDS = [
  "name",
  "taxNumber",
  "zipCode",
  "city",
  "address",
] as const;

export type CompanyProfileRequiredField = (typeof COMPANY_PROFILE_REQUIRED_FIELDS)[number];

/** The subset of Company/PublicCompany this check needs — satisfied by both. */
export type CompanyProfileLike = Partial<
  Record<CompanyProfileRequiredField, string | null | undefined>
>;

function isBlank(value: string | null | undefined): boolean {
  return !value || !value.trim();
}

/** The required fields that are missing or blank, in a stable field order. */
export function getMissingCompanyProfileFields(
  company: CompanyProfileLike | null | undefined
): CompanyProfileRequiredField[] {
  return COMPANY_PROFILE_REQUIRED_FIELDS.filter((field) => isBlank(company?.[field]));
}

/** True once every required field is present — the gate finalizing an invoice checks. */
export function isCompanyProfileComplete(
  company: CompanyProfileLike | null | undefined
): boolean {
  return getMissingCompanyProfileFields(company).length === 0;
}
