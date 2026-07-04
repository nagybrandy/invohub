// lib/invoices/types.ts
// Domain types for locally stored invoices (AsyncStorage).

export type InvoiceStatus =
  | "draft"
  | "proforma"
  | "sent"
  | "paid"
  | "overdue"
  | "cancelled";

export type VatRate = 0 | 5 | 27;

export type InvoiceCurrency = "EUR" | "HUF";

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: VatRate;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientTaxNumber?: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  currency: InvoiceCurrency;
  lineItems: InvoiceLineItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceTotals {
  subtotal: number;
  vatTotal: number;
  totalAmount: number;
}
