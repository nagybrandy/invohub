// lib/companies/service.ts
// Company profile CRUD for authenticated users.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { company } from "@/db/schema";
import { findClientByName } from "@/lib/clients/service";
import { normalizeEmailList, type EmailRecipientsInput } from "@/lib/email/recipients";
import { createId } from "@/lib/id";
import { encryptNavSecret, isMaskedNavSecret } from "@/lib/nav/credentials";
import { isNavEnvironment, parseNavEnvironment, type NavEnvironment } from "@/lib/nav/environment";

export type CompanyInput = {
  name: string;
  taxNumber?: string;
  euVatNumber?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  bankAccount?: string;
  logoUrl?: string;
  invoiceEmailTo?: string;
  invoiceEmailCc?: string;
  navTechnicalUser?: string;
  navTechnicalPassword?: string;
  navXmlSignKey?: string;
  navXmlChangeKey?: string;
  navEnvironment?: NavEnvironment;
  /** Alanyi adómentes (VAT-exempt sole trader) — new invoice lines default to AAM/0% VAT. */
  vatExempt?: boolean;
};

export type CompanyPatchInput = Partial<CompanyInput> & { name?: string };

/**
 * Server-side read model. SECURITY: `navTechnicalPassword`, `navXmlSignKey`
 * and `navXmlChangeKey` hold the value exactly as stored — sealed
 * (AES-256-GCM, see lib/nav/credentials.ts), or legacy plaintext until
 * scripts/reencrypt-nav-secrets.mjs has run. They are never decrypted here:
 * only resolveNavCredentials() / the receipt submit path decrypt them, in
 * memory, right before signing a NAV request. Never serialize a Company into
 * an API response — use toPublicCompany().
 */
export type Company = CompanyInput & {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

// PublicCompany / toPublicCompany (redacts the NAV secret fields for API
// responses) live in lib/companies/public-company.ts, not here — that
// module has no DB import, so it stays usable with jest.requireActual in
// tests that don't have a live DATABASE_URL. Re-exported here so existing
// `import { toPublicCompany } from "@/lib/companies/service"` call sites
// keep working.
export { toPublicCompany, type PublicCompany } from "@/lib/companies/public-company";

function patchOptionalField(
  next: string | undefined,
  previous: string | undefined
): string | null {
  if (next === undefined) return previous ?? null;
  const trimmed = next.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Like patchOptionalField, but for NAV secret columns: `previousRaw` is the
 * value exactly as stored (possibly AES-256-GCM encrypted, possibly legacy
 * plaintext) and is carried over unchanged when the caller isn't setting a
 * new value. A newly provided plaintext value is always encrypted before
 * storage — this throws NavCredentialsConfigError when NAV_CREDENTIALS_KEY
 * isn't configured, which is the "refuse to save without a key" behavior.
 */
function patchSecretField(next: string | undefined, previousRaw: string | null | undefined): string | null {
  // Omitted, or the client echoed back the mask it was shown → leave unchanged.
  if (typeof next !== "string" || isMaskedNavSecret(next)) return previousRaw ?? null;
  const trimmed = next.trim();
  if (!trimmed) return null;
  return encryptNavSecret(trimmed);
}

function mapRow(row: typeof company.$inferSelect): Company {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    taxNumber: row.taxNumber ?? undefined,
    euVatNumber: row.euVatNumber ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    zipCode: row.zipCode ?? undefined,
    country: row.country ?? undefined,
    bankAccount: row.bankAccount ?? undefined,
    logoUrl: row.logoUrl ?? undefined,
    invoiceEmailTo: row.invoiceEmailTo ?? undefined,
    invoiceEmailCc: row.invoiceEmailCc ?? undefined,
    navTechnicalUser: row.navTechnicalUser ?? undefined,
    // Sealed as stored — see the Company type. Not decrypted on read.
    navTechnicalPassword: row.navTechnicalPassword ?? undefined,
    navXmlSignKey: row.navXmlSignKey ?? undefined,
    navXmlChangeKey: row.navXmlChangeKey ?? undefined,
    navEnvironment: parseNavEnvironment(row.navEnvironment),
    vatExempt: row.vatExempt ?? false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildCompanyValues(
  input: Partial<CompanyInput> & { name: string },
  existingRow: typeof company.$inferSelect | null
) {
  return {
    name: input.name.trim(),
    taxNumber: patchOptionalField(input.taxNumber, existingRow?.taxNumber ?? undefined),
    euVatNumber: patchOptionalField(input.euVatNumber, existingRow?.euVatNumber ?? undefined),
    address: patchOptionalField(input.address, existingRow?.address ?? undefined),
    city: patchOptionalField(input.city, existingRow?.city ?? undefined),
    zipCode: patchOptionalField(input.zipCode, existingRow?.zipCode ?? undefined),
    country: patchOptionalField(input.country, existingRow?.country ?? undefined) ?? "HU",
    bankAccount: patchOptionalField(input.bankAccount, existingRow?.bankAccount ?? undefined),
    logoUrl: patchOptionalField(input.logoUrl, existingRow?.logoUrl ?? undefined),
    invoiceEmailTo: patchOptionalField(input.invoiceEmailTo, existingRow?.invoiceEmailTo ?? undefined),
    invoiceEmailCc: patchOptionalField(input.invoiceEmailCc, existingRow?.invoiceEmailCc ?? undefined),
    navTechnicalUser: patchOptionalField(input.navTechnicalUser, existingRow?.navTechnicalUser ?? undefined),
    navTechnicalPassword: patchSecretField(input.navTechnicalPassword, existingRow?.navTechnicalPassword),
    navXmlSignKey: patchSecretField(input.navXmlSignKey, existingRow?.navXmlSignKey),
    navXmlChangeKey: patchSecretField(input.navXmlChangeKey, existingRow?.navXmlChangeKey),
    vatExempt: input.vatExempt !== undefined ? input.vatExempt : existingRow?.vatExempt ?? false,
    navEnvironment:
      input.navEnvironment !== undefined
        ? isNavEnvironment(input.navEnvironment)
          ? input.navEnvironment
          : parseNavEnvironment(existingRow?.navEnvironment)
        : parseNavEnvironment(existingRow?.navEnvironment),
  };
}

async function getCompanyRowByUserId(userId: string): Promise<typeof company.$inferSelect | null> {
  const [row] = await db.select().from(company).where(eq(company.userId, userId));
  return row ?? null;
}

export async function getCompanyByUserId(userId: string): Promise<Company | null> {
  const row = await getCompanyRowByUserId(userId);
  return row ? mapRow(row) : null;
}

export async function upsertCompany(
  userId: string,
  input: Partial<CompanyInput> & { name: string }
): Promise<Company> {
  const existingRow = await getCompanyRowByUserId(userId);
  const now = new Date();
  const values = buildCompanyValues(input, existingRow);

  if (existingRow) {
    const [row] = await db
      .update(company)
      .set({ ...values, updatedAt: now })
      .where(eq(company.id, existingRow.id))
      .returning();
    return mapRow(row);
  }

  const id = createId();
  const [row] = await db
    .insert(company)
    .values({
      id,
      userId,
      ...values,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return mapRow(row);
}

export async function resolveInvoiceEmailRecipient(
  userId: string,
  clientName: string,
  override?: string
): Promise<string | null> {
  if (override?.trim()) return override.trim();

  const profile = await getCompanyByUserId(userId);
  if (profile?.invoiceEmailTo?.trim()) return profile.invoiceEmailTo.trim();

  const client = await findClientByName(userId, clientName);
  if (client?.email?.trim()) return client.email.trim();

  return null;
}

export async function resolveInvoiceEmailRecipients(
  userId: string,
  clientName: string,
  override?: EmailRecipientsInput
): Promise<string[]> {
  const overrides = normalizeEmailList(override);
  if (overrides.length > 0) {
    return overrides;
  }

  const fallback = await resolveInvoiceEmailRecipient(userId, clientName);
  return fallback ? [fallback] : [];
}
