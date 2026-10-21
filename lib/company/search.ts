// lib/company/search.ts
// "Search among Hungarian companies" for the partner field of an invoice.
//
// Two real sources, in order of how much we can trust them:
//   1. A typed adószám (8 digits, or 8-1-2 form) → NAV queryTaxpayer via
//      lookupCompanyByTaxNumber: authoritative name + address, free, and the
//      only source that yields the adószám an invoice needs.
//   2. A typed name → an external company registry. NAV has NO name search,
//      and Hungarian registry data (e-cegjegyzék, Opten, Céginformáció, …) is
//      only available through a keyed provider, so this is a seam: the
//      OpenCorporates provider below switches on when OPENCORPORATES_API_TOKEN
//      is set; without a provider the name search simply returns nothing and
//      the UI keeps offering saved partners + adószám lookup. Registry hits
//      carry a name and address but (OpenCorporates) NOT the adószám — the
//      cégjegyzékszám is a different number — so the user completes that.
import type { Company } from "@/lib/companies/service";
import { lookupCompanyByTaxNumber, type CompanyLookupResult } from "@/lib/company/lookup";

export type CompanySearchResult = CompanyLookupResult & {
  /** Where the hit came from — "nav" is authoritative for adószám + address. */
  source: "nav" | "registry";
  /** Cégjegyzékszám, when the registry provides it (not an adószám). */
  registrationNumber?: string;
};

export type CompanySearchResponse = {
  results: CompanySearchResult[];
  /** "none" when no name-search provider is configured (only adószám lookup works). */
  provider: "nav-only" | "opencorporates";
};

const MIN_NAME_QUERY = 3;
const MAX_RESULTS = 8;

/** 8 digits (törzsszám), or the full 8-1-2 adószám, with or without dashes. */
export function looksLikeTaxNumber(query: string): boolean {
  return /^\d{8}(-?\d(-?\d{2})?)?$/.test(query.trim());
}

type OpenCorporatesCompany = {
  name?: string;
  company_number?: string;
  inactive?: boolean;
  current_status?: string | null;
  registered_address_in_full?: string | null;
  registered_address?: {
    street_address?: string | null;
    locality?: string | null;
    postal_code?: string | null;
  } | null;
};

/** Pure: OpenCorporates search payload → our result shape (active companies only). */
export function parseOpenCorporatesResults(payload: unknown): CompanySearchResult[] {
  const companies = (payload as { results?: { companies?: { company?: OpenCorporatesCompany }[] } } | null)?.results
    ?.companies;
  if (!Array.isArray(companies)) return [];
  const out: CompanySearchResult[] = [];
  for (const entry of companies) {
    const c = entry?.company;
    if (!c?.name || c.inactive === true) continue;
    const addr = c.registered_address;
    out.push({
      source: "registry",
      name: c.name,
      taxNumber: "",
      country: "HU",
      registrationNumber: c.company_number,
      zipCode: addr?.postal_code ?? undefined,
      city: addr?.locality ?? undefined,
      address: addr?.street_address ?? c.registered_address_in_full ?? undefined,
    });
  }
  return out.slice(0, MAX_RESULTS);
}

type Fetcher = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

async function searchOpenCorporates(query: string, token: string, fetcher: Fetcher): Promise<CompanySearchResult[]> {
  const url =
    "https://api.opencorporates.com/v0.4/companies/search" +
    `?q=${encodeURIComponent(query)}&jurisdiction_code=hu&inactive=false&per_page=${MAX_RESULTS}` +
    `&api_token=${encodeURIComponent(token)}`;
  const res = await fetcher(url);
  if (!res.ok) return [];
  return parseOpenCorporatesResults(await res.json());
}

export async function searchHungarianCompanies(
  query: string,
  company: Company | null | undefined,
  deps: { env?: Record<string, string | undefined>; fetcher?: Fetcher; lookup?: typeof lookupCompanyByTaxNumber } = {},
): Promise<CompanySearchResponse> {
  const q = query.trim();
  const env = deps.env ?? process.env;
  const lookup = deps.lookup ?? lookupCompanyByTaxNumber;
  const token = env.OPENCORPORATES_API_TOKEN;
  const provider: CompanySearchResponse["provider"] = token ? "opencorporates" : "nav-only";

  if (looksLikeTaxNumber(q)) {
    const hit = await lookup(q, company);
    // The lookup answers an unknown-but-well-formed number with an empty shell — that is a miss.
    if (hit && (hit.name || hit.address || hit.city)) return { results: [{ ...hit, source: "nav" }], provider };
    return { results: [], provider };
  }

  if (q.length < MIN_NAME_QUERY || !token) return { results: [], provider };

  try {
    const fetcher: Fetcher = deps.fetcher ?? ((url) => fetch(url));
    return { results: await searchOpenCorporates(q, token, fetcher), provider };
  } catch {
    // A flaky third party must never break invoicing — behave as "no hits".
    return { results: [], provider };
  }
}
