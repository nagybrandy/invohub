// lib/company/lookup.ts
// Company lookup by tax number — MVP stub with mock data for Hungarian format.
export type CompanyLookupResult = {
  name: string;
  taxNumber: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country: string;
  euVatNumber?: string;
};

const MOCK_COMPANIES: Record<string, CompanyLookupResult> = {
  "12345678-1-23": {
    name: "Demo Kft.",
    taxNumber: "12345678-1-23",
    address: "Váci utca 1.",
    city: "Budapest",
    zipCode: "1052",
    country: "HU",
    euVatNumber: "HU12345678",
  },
  "98765432-2-43": {
    name: "Sample Zrt.",
    taxNumber: "98765432-2-43",
    address: "Andrássy út 10.",
    city: "Budapest",
    zipCode: "1061",
    country: "HU",
    euVatNumber: "HU98765432",
  },
};

export async function lookupCompanyByTaxNumber(
  taxNumber: string
): Promise<CompanyLookupResult | null> {
  const normalized = taxNumber.trim();
  if (!normalized) return null;

  const mock = MOCK_COMPANIES[normalized];
  if (mock) return mock;

  // Stub: return partial result so user can fill manually
  if (/^\d{8}-\d-\d{2}$/.test(normalized)) {
    return {
      name: "",
      taxNumber: normalized,
      country: "HU",
    };
  }

  return null;
}
