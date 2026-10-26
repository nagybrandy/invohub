// lib/company/lookup.ts
// Company lookup by tax number: real NAV queryTaxpayer when the company is
// in test/production mode with usable credentials, deterministic demo
// taxpayers otherwise (demo mode, the default, and the fallback when real
// credentials aren't configured yet).
import type { Company } from "@/lib/companies/service";
import { getNavClient } from "@/lib/nav/client";
import { isFresh, type CompanyDirectory, type DirectoryEntry } from "@/lib/company/directory-freshness";
import { resolveLookupCredentials } from "@/lib/nav/lookup-credentials";
import {
  NavCredentialsMissingError,
  resolveNavCredentials,
  type NavRealCredentials,
} from "@/lib/nav/resolve-credentials";

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

export type LookupDeps = {
  /** Shared cache of NAV answers; omitted → no caching (pure NAV/demo behaviour). */
  directory?: CompanyDirectory;
  /** The platform's read-only lookup account; defaults to the NAV_LOOKUP_* environment. */
  platformCredentials?: () => NavRealCredentials | null;
};

/** Never let a broken cache break invoicing. */
async function safely<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

/**
 * Resolution order for a well-formed adószám:
 *   1. a fresh company_directory row (no NAV call at all);
 *   2. NAV queryTaxpayer with the company's own technical user, else (demo
 *      mode / no usable credentials) the platform's read-only lookup account —
 *      a good production answer is written back to the directory;
 *   3. a stale directory row when NAV is unreachable;
 *   4. the deterministic demo lookup.
 * Answers from the NAV *test* environment describe fictional taxpayers and are
 * never cached.
 *
 * `company` is optional and defaults every caller to demo-mode behavior —
 * pass the requesting user's Company (from getCompanyByUserId) to enable a
 * real NAV lookup when they're in test/production mode with credentials.
 */
export async function lookupCompanyByTaxNumber(
  taxNumber: string,
  company?: Company | null,
  deps: LookupDeps = {}
): Promise<CompanyLookupResult | null> {
  const normalized = taxNumber.trim();
  if (!normalized) return null;

  const digitsOnly = normalized.replace(/\D/g, "");
  const digits = digitsOnly.length >= 8 ? digitsOnly.slice(0, 8) : "";
  const { directory } = deps;

  let cached: DirectoryEntry | null = null;
  if (digits && directory) {
    cached = await safely(() => directory.get(digits));
    if (cached && isFresh(cached.fetchedAt)) return cached.result;
  }

  if (digits) {
    const mode = company?.navEnvironment ?? "demo";
    let live: { credentials: NavRealCredentials; environment: "test" | "production"; own: boolean } | null = null;
    if (mode !== "demo") {
      try {
        live = { credentials: resolveNavCredentials(company ?? null), environment: mode, own: true };
      } catch (error) {
        if (!(error instanceof NavCredentialsMissingError)) throw error;
        // No usable real credentials of its own — try the platform account below.
      }
    }
    if (!live) {
      const platform = (deps.platformCredentials ?? resolveLookupCredentials)();
      if (platform) live = { credentials: platform, environment: platform.environment, own: false };
    }

    if (live) {
      try {
        const result = await getNavClient(live.environment).queryTaxpayer(live.credentials, digits);
        if (!result.valid) return null;
        const found: CompanyLookupResult = {
          name: result.name ?? "",
          taxNumber: result.vatCode && result.countyCode ? `${digits}-${result.vatCode}-${result.countyCode}` : normalized,
          address: result.address,
          city: result.city,
          zipCode: result.zipCode,
          country: result.country ?? "HU",
        };
        if (live.environment === "production" && directory && found.name) {
          await safely(() => directory.save(digits, found));
        }
        return found;
      } catch (error) {
        // The company's own credentials keep their loud failure; the shared
        // account and the cache are best-effort and degrade quietly.
        if (live.own) throw error;
        if (cached) return cached.result;
      }
    }
  }

  if (cached) return cached.result;
  return demoLookup(normalized);
}
