// lib/admin/service.ts
// Admin-only user management and platform stats.
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { client, company, invoice, product, user } from "@/db/schema";
import { isAssignableRole, type UserRole } from "@/lib/user-roles";

export type AdminUserSummary = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  companyName: string | null;
  /** Set once the account was closed (lib/account/closure.ts); null = active. */
  closedAt: string | null;
};

export type PlatformStats = {
  users: number;
  companies: number;
  invoices: number;
  clients: number;
  products: number;
};

export async function listAllUsers(): Promise<AdminUserSummary[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      closedAt: user.closedAt,
      companyName: company.name,
    })
    .from(user)
    .leftJoin(company, eq(company.userId, user.id));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    companyName: row.companyName ?? null,
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
  }));
}

export async function updateUserRole(
  userId: string,
  role: string
): Promise<AdminUserSummary | null> {
  if (!isAssignableRole(role)) {
    throw new Error("Invalid role.");
  }

  const now = new Date();
  const [updated] = await db
    .update(user)
    .set({ role, updatedAt: now })
    .where(eq(user.id, userId))
    .returning();

  if (!updated) return null;

  const [companyRow] = await db
    .select({ name: company.name })
    .from(company)
    .where(eq(company.userId, userId))
    .limit(1);

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    createdAt: updated.createdAt.toISOString(),
    companyName: companyRow?.name ?? null,
    closedAt: updated.closedAt ? updated.closedAt.toISOString() : null,
  };
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const [[usersRow], [companiesRow], [invoicesRow], [clientsRow], [productsRow]] =
    await Promise.all([
      db.select({ value: count() }).from(user),
      db.select({ value: count() }).from(company),
      db.select({ value: count() }).from(invoice),
      db.select({ value: count() }).from(client),
      db.select({ value: count() }).from(product),
    ]);

  return {
    users: usersRow?.value ?? 0,
    companies: companiesRow?.value ?? 0,
    invoices: invoicesRow?.value ?? 0,
    clients: clientsRow?.value ?? 0,
    products: productsRow?.value ?? 0,
  };
}

export async function promoteUserToAdmin(userId: string): Promise<void> {
  await updateUserRole(userId, "admin" satisfies UserRole);
}
