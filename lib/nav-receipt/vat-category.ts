// lib/nav-receipt/vat-category.ts
// Maps an InvoHub line-item VAT rate (+ the company's AAM/vatExempt flag) to
// the NAV eRECEIPT vat-category *name* string required in <vat> — NAV wants
// the published category name, not a rate code (see plan §1.2). VatCategoryNameType
// is only a regex pattern in the XSD; the authoritative name list lives in
// spec §5.9 and GET /vat-category/list, neither of which the planning pass
// could read.
//
// TODO(needs-human-review, OQ-1 in plan §8): these names are UNVERIFIED
// against the live NAV list — confirm each one (spelling, capitalization,
// exact wording) before this ships to real NAV test traffic. Do not scatter
// these strings elsewhere — always go through toNavVatCategory().
export const NAV_VAT_CATEGORIES = {
  aam: "Alanyi adómentes",
  rate0: "0%",
  rate5: "5%",
  rate18: "18%",
  rate27: "27%",
  other: "Egyéb",
} as const;

export type NavVatCategory = (typeof NAV_VAT_CATEGORIES)[keyof typeof NAV_VAT_CATEGORIES];

const RATE_TO_CATEGORY: Record<number, NavVatCategory> = {
  0: NAV_VAT_CATEGORIES.rate0,
  5: NAV_VAT_CATEGORIES.rate5,
  18: NAV_VAT_CATEGORIES.rate18,
  27: NAV_VAT_CATEGORIES.rate27,
};

/**
 * OQ-2 (plan §8, unresolved): a 0%-VAT line from a *non*-AAM company maps to
 * the "0%" category here, not the catch-all — confirm with human sign-off.
 */
export function toNavVatCategory(vatRate: number, opts?: { vatExempt?: boolean }): NavVatCategory {
  if (opts?.vatExempt) return NAV_VAT_CATEGORIES.aam;
  return RATE_TO_CATEGORY[vatRate] ?? NAV_VAT_CATEGORIES.other;
}
