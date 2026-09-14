// lib/company/lookup.ts
// Company lookup by tax number: real NAV queryTaxpayer when the company is
// in test/production mode with usable credentials, deterministic demo
// taxpayers otherwise (demo mode, the default, and the fallback when real
// credentials aren't configured yet).
import type { Company } from "@/lib/companies/service";
import { getNavClient } from "@/lib/nav/client";
import { NavCredentialsMissingError, resolveNavCredentials } from "@/lib/nav/resolve-credentials";

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

function demoLookup(normalized: string): CompanyLookupResult | null {
  const mock = MOCK_COMPANIES[normalized];
  if (mock) return mock;

  // Unknown but plausibly-formatted: return a partial result so the user can fill in manually.
  if (/^\d{8}-\d-\d{2}$/.test(normalized)) {
    return { name: "", taxNumber: normalized, country: "HU" };
  }

  return null;
}

/**
 * `company` is optional and defaults every caller to demo-mode behavior —
 * pass the requesting user's Company (from getCompanyByUserId) to enable a
 * real NAV lookup when they're in test/production mode with credentials.
 */
export async function lookupCompanyByTaxNumber(
  taxNumber: string,
  company?: Company | null
): Promise<CompanyLookupResult | null> {
  const normalized = taxNumber.trim();
  if (!normalized) return null;

  const mode = company?.navEnvironment ?? "demo";
  if (mode !== "demo") {
    const digits = normalized.replace(/\D/g, "").slice(0, 8);
    if (digits.length === 8) {
      try {
        const credentials = resolveNavCredentials(company ?? null);
        const client = getNavClient(mode);
        const result = await client.queryTaxpayer(credentials, digits);
        if (!result.valid) return null;
        return {
          name: result.name ?? "",
          taxNumber: normalized,
          address: result.address,
          city: result.city,
          zipCode: result.zipCode,
          country: result.country ?? "HU",
        };
      } catch (error) {
        if (!(error instanceof NavCredentialsMissingError)) throw error;
        // No usable real credentials yet — fall through to the demo lookup
        // so the UI still works while the owner finishes NAV setup.
      }
    }
  }

  return demoLookup(normalized);
}
