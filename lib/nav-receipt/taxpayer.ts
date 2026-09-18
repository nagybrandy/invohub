// lib/nav-receipt/taxpayer.ts
// NAV eRECEIPT's <taxPayerId> (ntcaCustomer:TaxpayerIdType) is strictly
// `[0-9]{8}` — no dashes, no VAT-code/county suffix, unlike InvoHub's
// stored company.taxNumber which may carry the full OSA-style
// "12345678-1-42" form. This normalizes any of those shapes down to the
// 8-digit core NAV eRECEIPT expects (see plan §1.2 AC5).
export function toTaxpayerId(raw: string): string {
  const digitsOnly = raw.replace(/[^0-9]/g, "");
  if (digitsOnly.length < 8) {
    throw new Error(
      `Invalid NAV tax number "${raw}": expected at least 8 digits for a TaxpayerIdType.`
    );
  }
  return digitsOnly.slice(0, 8);
}
