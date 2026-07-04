// lib/products/service.ts
// Product catalog CRUD for authenticated users.
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { product } from "@/db/schema";
import { createId } from "@/lib/id";

export type ProductInput = {
  name: string;
  description?: string;
  unitPrice: number;
  vatRate?: number;
  currency?: string;
  unit?: string;
};

export type Product = ProductInput & {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: typeof product.$inferSelect): Product {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? undefined,
    unitPrice: Number(row.unitPrice),
    vatRate: row.vatRate,
    currency: row.currency,
    unit: row.unit ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listProducts(userId: string): Promise<Product[]> {
  const rows = await db.select().from(product).where(eq(product.userId, userId));
  return rows.map(mapRow);
}

export async function getProductById(
  userId: string,
  id: string
): Promise<Product | null> {
  const [row] = await db
    .select()
    .from(product)
    .where(and(eq(product.id, id), eq(product.userId, userId)));
  return row ? mapRow(row) : null;
}

export async function createProduct(
  userId: string,
  input: ProductInput
): Promise<Product> {
  const now = new Date();
  const id = createId();
  const [row] = await db
    .insert(product)
    .values({
      id,
      userId,
      name: input.name,
      description: input.description ?? null,
      unitPrice: String(input.unitPrice),
      vatRate: input.vatRate ?? 27,
      currency: input.currency ?? "EUR",
      unit: input.unit ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return mapRow(row);
}

export async function updateProduct(
  userId: string,
  id: string,
  input: Partial<ProductInput>
): Promise<Product | null> {
  const existing = await getProductById(userId, id);
  if (!existing) return null;

  const now = new Date();
  const [row] = await db
    .update(product)
    .set({
      name: input.name ?? existing.name,
      description: input.description ?? existing.description ?? null,
      unitPrice: String(input.unitPrice ?? existing.unitPrice),
      vatRate: input.vatRate ?? existing.vatRate,
      currency: input.currency ?? existing.currency,
      unit: input.unit ?? existing.unit ?? null,
      updatedAt: now,
    })
    .where(eq(product.id, id))
    .returning();
  return mapRow(row);
}

export async function deleteProductById(
  userId: string,
  id: string
): Promise<boolean> {
  const result = await db
    .delete(product)
    .where(and(eq(product.id, id), eq(product.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}
