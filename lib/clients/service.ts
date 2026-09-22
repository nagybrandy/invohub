// lib/clients/service.ts
// Client CRUD for authenticated users.
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { client } from "@/db/schema";
import { createId } from "@/lib/id";
import { normalizeClientPartyType, type ClientPartyType } from "@/lib/clients/party-type";

export type ClientInput = {
  name: string;
  email?: string;
  taxNumber?: string;
  euVatNumber?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  /** Company vs. private person (natural person, not a VAT subject) — see lib/clients/party-type.ts. */
  partyType?: ClientPartyType;
};

export type Client = ClientInput & {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: typeof client.$inferSelect): Client {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    email: row.email ?? undefined,
    taxNumber: row.taxNumber ?? undefined,
    euVatNumber: row.euVatNumber ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    zipCode: row.zipCode ?? undefined,
    country: row.country ?? undefined,
    partyType: normalizeClientPartyType(row.partyType) ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listClients(userId: string): Promise<Client[]> {
  const rows = await db.select().from(client).where(eq(client.userId, userId));
  return rows.map(mapRow);
}

export async function getClientById(
  userId: string,
  id: string
): Promise<Client | null> {
  const [row] = await db
    .select()
    .from(client)
    .where(and(eq(client.id, id), eq(client.userId, userId)));
  return row ? mapRow(row) : null;
}

export async function createClient(
  userId: string,
  input: ClientInput
): Promise<Client> {
  const now = new Date();
  const id = createId();
  const [row] = await db
    .insert(client)
    .values({
      id,
      userId,
      name: input.name,
      email: input.email ?? null,
      taxNumber: input.taxNumber ?? null,
      euVatNumber: input.euVatNumber ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      zipCode: input.zipCode ?? null,
      country: input.country ?? null,
      partyType: normalizeClientPartyType(input.partyType),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return mapRow(row);
}

export async function updateClient(
  userId: string,
  id: string,
  input: Partial<ClientInput>
): Promise<Client | null> {
  const existing = await getClientById(userId, id);
  if (!existing) return null;

  const now = new Date();
  const [row] = await db
    .update(client)
    .set({
      name: input.name ?? existing.name,
      email: input.email ?? existing.email ?? null,
      taxNumber: input.taxNumber ?? existing.taxNumber ?? null,
      euVatNumber: input.euVatNumber ?? existing.euVatNumber ?? null,
      address: input.address ?? existing.address ?? null,
      city: input.city ?? existing.city ?? null,
      zipCode: input.zipCode ?? existing.zipCode ?? null,
      country: input.country ?? existing.country ?? null,
      partyType:
        input.partyType !== undefined
          ? normalizeClientPartyType(input.partyType)
          : (existing.partyType ?? null),
      updatedAt: now,
    })
    .where(eq(client.id, id))
    .returning();
  return mapRow(row);
}

export async function deleteClientById(
  userId: string,
  id: string
): Promise<boolean> {
  const result = await db
    .delete(client)
    .where(and(eq(client.id, id), eq(client.userId, userId)));
  return (result.rowCount ?? 0) > 0;
}

export async function findClientByTaxNumber(
  userId: string,
  taxNumber: string
): Promise<Client | null> {
  const [row] = await db
    .select()
    .from(client)
    .where(and(eq(client.userId, userId), eq(client.taxNumber, taxNumber)));
  return row ? mapRow(row) : null;
}

export async function findClientByName(
  userId: string,
  name: string
): Promise<Client | null> {
  const [row] = await db
    .select()
    .from(client)
    .where(and(eq(client.userId, userId), eq(client.name, name)))
    .limit(1);
  return row ? mapRow(row) : null;
}
