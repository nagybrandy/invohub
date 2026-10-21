// lib/company/directory-freshness.ts
// DB-free half of the company directory (see directory.ts) so the lookup
// logic and its tests don't pull in the database client.
import type { CompanyLookupResult } from "@/lib/company/lookup";

/** NAV data changes rarely (seat moves, renames); a month keeps it honest without hammering NAV. */
export const DIRECTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function isFresh(fetchedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - fetchedAt.getTime() < DIRECTORY_TTL_MS;
}

export type DirectoryEntry = { result: CompanyLookupResult; fetchedAt: Date };

export type CompanyDirectory = {
  get(taxNumberBase: string): Promise<DirectoryEntry | null>;
  save(taxNumberBase: string, result: CompanyLookupResult): Promise<void>;
};
