// lib/invoices/mappers.ts
// Maps between DB rows and domain Invoice types.
import type { invoice, invoiceLineItem } from "@/db/schema";
import { resolvePaymentMethod } from "@/lib/invoices/payment-status";
import type {
  Invoice,
  InvoiceDocumentType,
  InvoiceLineItem,
  InvoiceStatus,
  PaymentMethod,
  VatCategory,
  VatRate,
} from "@/lib/invoices/types";

type InvoiceRow = typeof invoice.$inferSelect;
type LineItemRow = typeof invoiceLineItem.$inferSelect;

function toIsoString(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toOptionalIsoString(value: Date | string | null): string | undefined {
  if (value == null) return undefined;
  return toIsoString(value);
}

function toOptionalNumber(value: string | number | null): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

export function mapLineItemFromDb(row: LineItemRow): InvoiceLineItem {
  return {
    id: row.id,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unitPrice),
    vatRate: row.vatRate as VatRate,
    vatCategory: (row.vatCategory as VatCategory | undefined) ?? "normal",
    vatExemptionReason: row.vatExemptionReason ?? undefined,
  };
}

export function mapInvoiceFromDb(
  row: InvoiceRow,
  lineItems: LineItemRow[]
): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    documentType: (row.documentType as InvoiceDocumentType | undefined) ?? "invoice",
    clientName: row.clientName,
    clientTaxNumber: row.clientTaxNumber ?? undefined,
    clientId: row.clientId ?? undefined,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    status: row.status as InvoiceStatus,
    currency: row.currency as Invoice["currency"],
    exchangeRate: toOptionalNumber(row.exchangeRate),
    lineItems: lineItems
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(mapLineItemFromDb),
    notes: row.notes ?? undefined,
    paymentMethod: resolvePaymentMethod(row.paymentMethod as PaymentMethod | null, row.notes),
    paidAt: toOptionalIsoString(row.paidAt),
    paidAmount: toOptionalNumber(row.paidAmount),
    originalInvoiceId: row.originalInvoiceId ?? undefined,
    modifiesInvoiceId: row.modifiesInvoiceId ?? undefined,
    modificationIndex: row.modificationIndex ?? undefined,
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
    vatCategory: item.vatCategory,
    vatExemptionReason: item.vatExemptionReason ?? null,
    sortOrder,
  };
}

export function mapInvoiceToDb(
  inv: Invoice,
  userId: string,
  companyId?: string | null,
) {
  return {
    id: inv.id,
    userId,
    companyId: companyId ?? null,
    clientId: inv.clientId ?? null,
    invoiceNumber: inv.invoiceNumber,
    documentType: inv.documentType,
    clientName: inv.clientName,
    clientTaxNumber: inv.clientTaxNumber ?? null,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    status: inv.status,
    currency: inv.currency,
    exchangeRate: inv.exchangeRate != null ? String(inv.exchangeRate) : null,
    notes: inv.notes ?? null,
    paymentMethod: inv.paymentMethod ?? null,
    paidAt: inv.paidAt ? new Date(inv.paidAt) : null,
    paidAmount: inv.paidAmount != null ? String(inv.paidAmount) : null,
    originalInvoiceId: inv.originalInvoiceId ?? null,
    modifiesInvoiceId: inv.modifiesInvoiceId ?? null,
    modificationIndex: inv.modificationIndex ?? null,
  };
}
