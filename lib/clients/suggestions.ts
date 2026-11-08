// lib/clients/suggestions.ts
// Read-only loader behind GET /api/clients/suggestions: partners the account
// has already invoiced, with what is usually set for them. Three bounded
// queries (recent issued invoices, the saved partners, the last invoices'
// lines) — no per-partner round trips. Scoped to `userId`, which for an
// API request is the ACTIVE billing account (requireSession swaps it).
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { client, invoice, invoiceLineItem } from "@/db/schema";
import {
  buildPartnerSuggestions,
  SUGGESTION_LIMIT,
  type PartnerSuggestion,
  type SuggestionClientRow,
} from "@/lib/clients/suggestions-core";
import { normalizeClientPartyType } from "@/lib/clients/party-type";

/** How many of the most recent issued invoices are considered. */
const INVOICE_WINDOW = 400;

export async function listPartnerSuggestions(
  userId: string,
  query: string,
  limit: number = SUGGESTION_LIMIT
): Promise<PartnerSuggestion[]> {
  const invoices = await db
    .select({
      id: invoice.id,
      userId: invoice.userId,
      clientId: invoice.clientId,
      clientName: invoice.clientName,
      clientTaxNumber: invoice.clientTaxNumber,
      clientZipCode: invoice.clientZipCode,
      clientCity: invoice.clientCity,
      clientAddress: invoice.clientAddress,
      clientCountry: invoice.clientCountry,
      clientEuVatNumber: invoice.clientEuVatNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      language: invoice.language,
      paymentMethod: invoice.paymentMethod,
      documentType: invoice.documentType,
      status: invoice.status,
    })
    .from(invoice)
    .where(
      and(
        eq(invoice.userId, userId),
        eq(invoice.documentType, "invoice"),
        ne(invoice.status, "draft"),
        ne(invoice.status, "proforma")
      )
    )
    .orderBy(desc(invoice.issueDate), desc(invoice.createdAt))
    .limit(INVOICE_WINDOW);
  if (invoices.length === 0) return [];

  const clientRows = await db.select().from(client).where(eq(client.userId, userId));
  const clients: SuggestionClientRow[] = clientRows.map((row) => ({
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
  }));

  const ranked = buildPartnerSuggestions(invoices, [], { userId, query, limit, clients });
  if (ranked.length === 0) return [];

  const lines = await db
    .select()
    .from(invoiceLineItem)
    .where(inArray(invoiceLineItem.invoiceId, ranked.map((s) => s.latestInvoiceId)));

  return buildPartnerSuggestions(invoices, lines, { userId, query, limit, clients });
}
