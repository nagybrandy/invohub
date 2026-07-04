// lib/invoices/calculations.ts
// Invoice line-item and document total calculations.

import type { Invoice, InvoiceLineItem, InvoiceTotals } from "@/lib/invoices/types";

export function lineItemNetTotal(item: InvoiceLineItem): number {
  return item.quantity * item.unitPrice;
}

export function lineItemVatAmount(item: InvoiceLineItem): number {
  return lineItemNetTotal(item) * (item.vatRate / 100);
}

export function lineItemGrossTotal(item: InvoiceLineItem): number {
  return lineItemNetTotal(item) + lineItemVatAmount(item);
}

export function calculateInvoiceTotals(lineItems: InvoiceLineItem[]): InvoiceTotals {
  const subtotal = lineItems.reduce((sum, item) => sum + lineItemNetTotal(item), 0);
  const vatTotal = lineItems.reduce((sum, item) => sum + lineItemVatAmount(item), 0);
  return {
    subtotal,
    vatTotal,
    totalAmount: subtotal + vatTotal,
  };
}

export function formatCurrency(amount: number, currency: Invoice["currency"]): string {
  const symbol = currency === "EUR" ? "€" : "Ft";
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: currency === "EUR" ? 2 : 0,
    maximumFractionDigits: currency === "EUR" ? 2 : 0,
  });
  return currency === "EUR" ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
}

export function generateInvoiceNumber(existing: Invoice[]): string {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const sameYear = existing.filter((inv) => inv.invoiceNumber.startsWith(prefix));
  const next = sameYear.length + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export function createEmptyLineItem(): InvoiceLineItem {
  return {
    id: createId(),
    description: "",
    quantity: 1,
    unitPrice: 0,
    vatRate: 27,
  };
}

export function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isCurrentMonth(isoDate: string): boolean {
  const date = new Date(isoDate);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}
