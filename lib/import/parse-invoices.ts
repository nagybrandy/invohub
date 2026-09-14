// lib/import/parse-invoices.ts
// Parses Excel/CSV rows into draft invoice payloads.
import * as XLSX from "xlsx";
import { createId } from "@/lib/id";
import type { Invoice, InvoiceLineItem } from "@/lib/invoices/types";

export type ParsedInvoiceDraft = Omit<Invoice, "createdAt" | "updatedAt">;

export function parseInvoiceSpreadsheet(buffer: ArrayBuffer): ParsedInvoiceDraft[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  return rows.map((row, index) => {
    const clientName = String(row.client_name ?? row.clientName ?? row.Client ?? "Unknown");
    const description = String(row.description ?? row.item ?? "Service");
    const quantity = Number(row.quantity ?? 1);
    const unitPrice = Number(row.unit_price ?? row.unitPrice ?? row.price ?? 0);
    const vatRate = Number(row.vat_rate ?? row.vatRate ?? 27) as InvoiceLineItem["vatRate"];

    const lineItem: InvoiceLineItem = {
      id: createId(),
      description,
      quantity: Number.isFinite(quantity) ? quantity : 1,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      vatRate: ([0, 5, 18, 27] as const).includes(vatRate as 0 | 5 | 18 | 27)
        ? (vatRate as InvoiceLineItem["vatRate"])
        : 27,
      vatCategory: "normal",
    };

    const now = new Date().toISOString();
    return {
      id: createId(),
      invoiceNumber: String(row.invoice_number ?? `IMPORT-${index + 1}`),
      documentType: "invoice",
      clientName,
      clientTaxNumber: row.client_tax_number
        ? String(row.client_tax_number)
        : undefined,
      issueDate: String(row.issue_date ?? now.slice(0, 10)),
      dueDate: String(row.due_date ?? now.slice(0, 10)),
      status: "draft",
      currency: (row.currency === "HUF" ? "HUF" : "EUR") as Invoice["currency"],
      lineItems: [lineItem],
      notes: row.notes ? String(row.notes) : undefined,
    };
  });
}
