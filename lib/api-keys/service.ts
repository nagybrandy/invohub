// lib/api-keys/service.ts
// API key CRUD and lookup for external invoice API access.
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKey } from "@/db/schema";
import {
  generatePublicKey,
  generateSecretKey,
  hashSecretKey,
  verifySecretKey,
} from "@/lib/api-keys/crypto";
import { createId } from "@/lib/id";

export type ApiKeyRecord = {
  id: string;
  userId: string;
  name: string;
  publicKey: string;
  enabled: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatedApiKey = ApiKeyRecord & {
  /** Shown once at creation — never stored in plain text. */
  secretKey: string;
};

function mapRow(row: typeof apiKey.$inferSelect): ApiKeyRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    publicKey: row.publicKey,
    enabled: row.enabled,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listApiKeys(userId: string): Promise<ApiKeyRecord[]> {
  const rows = await db
    .select()
    .from(apiKey)
    .where(eq(apiKey.userId, userId))
    .orderBy(desc(apiKey.createdAt));
  return rows.map(mapRow);
}

export async function createApiKey(
  userId: string,
  name: string
): Promise<CreatedApiKey> {
  const now = new Date();
  const publicKeyValue = generatePublicKey();
  const secretKeyValue = generateSecretKey();
  const id = createId();

  const [row] = await db
    .insert(apiKey)
    .values({
      id,
      userId,
      name: name.trim() || "External API",
      publicKey: publicKeyValue,
      secretHash: hashSecretKey(secretKeyValue),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return {
    ...mapRow(row),
    secretKey: secretKeyValue,
  };
}

export async function revokeApiKey(userId: string, id: string): Promise<boolean> {
  const result = await db
    .delete(apiKey)
    .where(and(eq(apiKey.id, id), eq(apiKey.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

export async function authenticateApiKey(
  publicKeyValue: string,
  secretKeyValue: string
): Promise<ApiKeyRecord | null> {
  const [row] = await db
    .select()
    .from(apiKey)
    .where(and(eq(apiKey.publicKey, publicKeyValue), eq(apiKey.enabled, true)))
    .limit(1);

  if (!row || !verifySecretKey(secretKeyValue, row.secretHash)) {
    return null;
  }

  const now = new Date();
  await db
    .update(apiKey)
    .set({ lastUsedAt: now, updatedAt: now })
    .where(eq(apiKey.id, row.id));

  return mapRow({ ...row, lastUsedAt: now, updatedAt: now });
}
