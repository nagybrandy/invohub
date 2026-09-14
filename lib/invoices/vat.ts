// lib/invoices/vat.ts
// NAV VAT category metadata: rate resolution, exemption/reverse-charge reasons.
import type { VatCategory, VatRate } from "@/lib/invoices/types";

export const VAT_RATES: VatRate[] = [0, 5, 18, 27];

export const VAT_CATEGORIES: VatCategory[] = [
  "normal",
  "AAM",
  "TAM",
  "KBAET",
  "AHK",
  "FAD",
  "ATK",
];

/** Every category but "normal" always carries 0% VAT — the rate field is only meaningful for "normal". */
export function isExemptVatCategory(category: VatCategory): boolean {
  return category !== "normal";
}

/** The VAT rate that actually applies: exempt/reverse-charge categories are forced to 0%. */
export function resolveVatRate(category: VatCategory, rate: VatRate): VatRate {
  return isExemptVatCategory(category) ? 0 : rate;
}

const DEFAULT_REASON_HU: Record<Exclude<VatCategory, "normal">, string> = {
  AAM: "Alanyi adómentes",
  TAM: "Tárgyi adómentes",
  KBAET: "Adómentes Közösségen belüli termékértékesítés – új közlekedési eszköz",
  AHK: "Adómentes Közösségen belüli termékértékesítés – jövedéki termék",
  FAD: "Fordított adózás",
  ATK: "Áfa tárgyi hatályán kívüli",
};

/** The stock NAV-style reason text for a category, or undefined for "normal" (taxed) lines. */
export function defaultVatExemptionReason(category: VatCategory): string | undefined {
  if (category === "normal") return undefined;
  return DEFAULT_REASON_HU[category];
}

/** Reason to print on the PDF/preview: an explicit override wins, else the category default. */
export function resolveVatExemptionReason(
  category: VatCategory,
  explicitReason?: string
): string | undefined {
  const trimmed = explicitReason?.trim();
  if (trimmed) return trimmed;
  return defaultVatExemptionReason(category);
}

/** Short label printed in the VAT column instead of a percentage for non-"normal" categories. */
export function vatCategoryShortLabel(category: VatCategory): string {
  return category;
}
