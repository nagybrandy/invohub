// lib/company/directory.ts
// Shared cache of NAV queryTaxpayer answers (company_directory table). Public
// registry data keyed by the 8-digit törzsszám: once anyone looked an adószám
// up, the next lookup is a DB read instead of a NAV round trip.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companyDirectory as companyDirectoryTable } from "@/db/schema";
import { type CompanyDirectory } from "@/lib/company/directory-freshness";

export { DIRECTORY_TTL_MS, isFresh, type DirectoryEntry } from "@/lib/company/directory-freshness";


export const companyDirectory: CompanyDirectory = {
  async get(taxNumberBase) {
    const [row] = await db
      .select()
      .from(companyDirectoryTable)
      .where(eq(companyDirectoryTable.taxNumberBase, taxNumberBase))
      .limit(1);
    if (!row) return null;
    return {
      fetchedAt: row.fetchedAt,
      result: {
        name: row.name,
        taxNumber: row.taxNumber,
        zipCode: row.zipCode ?? undefined,
        city: row.city ?? undefined,
        address: row.address ?? undefined,
        country: row.country,
      },
    };
  },

  async save(taxNumberBase, result) {
    if (!result.name.trim()) return;
    const values = {
      taxNumber: result.taxNumber,
      name: result.name,
      zipCode: result.zipCode ?? null,
      city: result.city ?? null,
      address: result.address ?? null,
      country: result.country || "HU",
      fetchedAt: new Date(),
    };
    await db
      .insert(companyDirectoryTable)
      .values({ taxNumberBase, ...values })
      .onConflictDoUpdate({ target: companyDirectoryTable.taxNumberBase, set: values });
  },
};
