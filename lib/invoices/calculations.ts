// lib/invoices/calculations.ts
// Invoice line-item and document total calculations.

import { resolveVatRate } from "@/lib/invoices/vat";
import type { Invoice, InvoiceLineItem, InvoiceTotals } from "@/lib/invoices/types";

export function lineItemNetTotal(item: InvoiceLineItem): number {
  return item.quantity * item.unitPrice;
}

export function lineItemEffectiveVatRate(item: InvoiceLineItem): number {
  return resolveVatRate(item.vatCategory, item.vatRate);
}

export function lineItemVatAmount(item: InvoiceLineItem): number {
  return lineItemNetTotal(item) * (lineItemEffectiveVatRate(item) / 100);
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

export type VatSummaryRow = {
  /** "27" for a taxed rate, the category code ("AAM", "TAM", …) for an exempt line. */
  key: string;
  /** What the document prints in the rate column: "27%" or the category code. */
  label: string;
  net: number;
  vat: number;
  gross: number;
};

/**
 * Per-rate tax base / tax amount breakdown for the outgoing document
 * (Áfa tv. 169. § j)–k): the tax base and the tax amount "adómértékenként").
 * Taxed rates come first, highest rate first; exempt categories follow as
 * their own zero-VAT groups. Display only — lib/nav/invoice-xml.ts keeps its
 * own NAV-specific grouping.
 */
export function vatSummaryByRate(lineItems: InvoiceLineItem[]): VatSummaryRow[] {
  const groups = new Map<string, VatSummaryRow & { rate: number; exempt: boolean }>();
  for (const item of lineItems) {
    const exempt = item.vatCategory !== "normal";
    const key = exempt ? item.vatCategory : String(item.vatRate);
    const net = lineItemNetTotal(item);
    const vat = lineItemVatAmount(item);
    const existing = groups.get(key);
    if (existing) {
      existing.net += net;
      existing.vat += vat;
      existing.gross += net + vat;
    } else {
      groups.set(key, {
        key,
        label: exempt ? item.vatCategory : `${item.vatRate}%`,
        net,
        vat,
        gross: net + vat,
        rate: exempt ? -1 : item.vatRate,
        exempt,
      });
    }
  }
  return Array.from(groups.values())
    .sort((a, b) => (a.exempt === b.exempt ? b.rate - a.rate || a.key.localeCompare(b.key) : a.exempt ? 1 : -1))
    .map(({ key, label, net, vat, gross }) => ({ key, label, net, vat, gross }));
}

export function formatCurrency(amount: number, currency: Invoice["currency"]): string {
  const symbol = currency === "EUR" ? "€" : "Ft";
  const digits = currency === "EUR" ? 2 : 0;
  // A helyesbítő draft nets to zero; never show "-0 Ft" for a float residue.
  const value = Math.abs(amount) < 0.5 / 10 ** digits ? 0 : amount;
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: currency === "EUR" ? 2 : 0,
    maximumFractionDigits: currency === "EUR" ? 2 : 0,
  });
  return currency === "EUR" ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
}

export type CreateEmptyLineItemOptions = {
  /** Company is alanyi adómentes (VAT-exempt) — default new lines to AAM/0% instead of 27%. */
  vatExempt?: boolean;
};

export function createEmptyLineItem(
  options: CreateEmptyLineItemOptions = {}
): InvoiceLineItem {
  if (options.vatExempt) {
    return {
      id: createId(),
      description: "",
      quantity: 1,
      unitPrice: 0,
      vatRate: 0,
      vatCategory: "AAM",
    };
  }
  return {
    id: createId(),
    description: "",
    quantity: 1,
    unitPrice: 0,
    vatRate: 27,
    vatCategory: "normal",
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
