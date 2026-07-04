// lib/invoices/mappers.ts
// Maps between DB rows and domain Invoice types.
import type { invoice, invoiceLineItem } from "@/db/schema";
import type { Invoice, InvoiceLineItem, InvoiceStatus, VatRate } from "@/lib/invoices/types";

type InvoiceRow = typeof invoice.$inferSelect;
type LineItemRow = typeof invoiceLineItem.$inferSelect;

function toIsoString(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function mapLineItemFromDb(row: LineItemRow): InvoiceLineItem {
  return {
    id: row.id,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unitPrice),
    vatRate: row.vatRate as VatRate,
  };
}

export function mapInvoiceFromDb(
  row: InvoiceRow,
  lineItems: LineItemRow[]
): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    clientName: row.clientName,
    clientTaxNumber: row.clientTaxNumber ?? undefined,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    status: row.status as InvoiceStatus,
    currency: row.currency as Invoice["currency"],
    lineItems: lineItems
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(mapLineItemFromDb),
    notes: row.notes ?? undefined,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export function mapLineItemToDb(
  item: InvoiceLineItem,
  invoiceId: string,
  sortOrder: number
) {
  return {
    id: item.id,
    invoiceId,
    description: item.description,
    quantity: String(item.quantity),
    unitPrice: String(item.unitPrice),
    vatRate: item.vatRate,
    sortOrder,
  };
}

export function mapInvoiceToDb(
  inv: Invoice,
  userId: string,
  companyId?: string | null,
  clientId?: string | null
) {
  return {
    id: inv.id,
    userId,
    companyId: companyId ?? null,
    clientId: clientId ?? null,
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.clientName,
    clientTaxNumber: inv.clientTaxNumber ?? null,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    status: inv.status,
    currency: inv.currency,
    notes: inv.notes ?? null,
  };
}
