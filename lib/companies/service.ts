// lib/companies/service.ts
// Company profile CRUD for authenticated users.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { company } from "@/db/schema";
import { findClientByName } from "@/lib/clients/service";
import { normalizeEmailList, type EmailRecipientsInput } from "@/lib/email/recipients";
import { createId } from "@/lib/id";
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
  navEnvironment?: NavEnvironment;
  /** Alanyi adómentes (VAT-exempt sole trader) — new invoice lines default to AAM/0% VAT. */
  vatExempt?: boolean;
};

export type CompanyPatchInput = Partial<CompanyInput> & { name?: string };

export type Company = CompanyInput & {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

function patchOptionalField(
  next: string | undefined,
  previous: string | undefined
): string | null {
  if (next === undefined) return previous ?? null;
  const trimmed = next.trim();
  return trimmed.length > 0 ? trimmed : null;
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
    navTechnicalPassword: row.navTechnicalPassword ?? undefined,
    navXmlSignKey: row.navXmlSignKey ?? undefined,
    navEnvironment: parseNavEnvironment(row.navEnvironment),
    vatExempt: row.vatExempt ?? false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildCompanyValues(
  input: Partial<CompanyInput> & { name: string },
  existing: Company | null
) {
  return {
    name: input.name.trim(),
    taxNumber: patchOptionalField(input.taxNumber, existing?.taxNumber),
    euVatNumber: patchOptionalField(input.euVatNumber, existing?.euVatNumber),
    address: patchOptionalField(input.address, existing?.address),
    city: patchOptionalField(input.city, existing?.city),
    zipCode: patchOptionalField(input.zipCode, existing?.zipCode),
    country: patchOptionalField(input.country, existing?.country) ?? "HU",
    bankAccount: patchOptionalField(input.bankAccount, existing?.bankAccount),
    logoUrl: patchOptionalField(input.logoUrl, existing?.logoUrl),
    invoiceEmailTo: patchOptionalField(input.invoiceEmailTo, existing?.invoiceEmailTo),
    invoiceEmailCc: patchOptionalField(input.invoiceEmailCc, existing?.invoiceEmailCc),
    navTechnicalUser: patchOptionalField(input.navTechnicalUser, existing?.navTechnicalUser),
    navTechnicalPassword: patchOptionalField(
      input.navTechnicalPassword,
      existing?.navTechnicalPassword
    ),
    navXmlSignKey: patchOptionalField(input.navXmlSignKey, existing?.navXmlSignKey),
    vatExempt: input.vatExempt !== undefined ? input.vatExempt : existing?.vatExempt ?? false,
    navEnvironment:
      input.navEnvironment !== undefined
        ? isNavEnvironment(input.navEnvironment)
          ? input.navEnvironment
          : parseNavEnvironment(existing?.navEnvironment)
        : parseNavEnvironment(existing?.navEnvironment),
  };
}

export async function getCompanyByUserId(userId: string): Promise<Company | null> {
  const [row] = await db.select().from(company).where(eq(company.userId, userId));
  return row ? mapRow(row) : null;
}

export async function upsertCompany(
  userId: string,
  input: Partial<CompanyInput> & { name: string }
): Promise<Company> {
  const existing = await getCompanyByUserId(userId);
  const now = new Date();
  const values = buildCompanyValues(input, existing);

  if (existing) {
    const [row] = await db
      .update(company)
      .set({ ...values, updatedAt: now })
      .where(eq(company.id, existing.id))
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
