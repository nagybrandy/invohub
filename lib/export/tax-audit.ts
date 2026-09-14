// lib/export/tax-audit.ts
// Generates CSV bundle for tax authority audit export.
import { listInvoicesInDateRange } from "@/lib/invoices/service";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";

export async function generateTaxAuditExport(
  userId: string,
  from: string,
  to: string
): Promise<string> {
  // Date range is pushed into the SQL WHERE clause and paginated inside
  // listInvoicesInDateRange, so every matching invoice is exported — not
  // just whatever fit inside the first page of the general list endpoint.
  const invoices = await listInvoicesInDateRange(userId, from, to);

  const header =
    "invoice_number,document_type,client_name,client_tax_number,issue_date,due_date,status,currency,subtotal,vat,total,line_items_count";
  const rows = invoices.map((inv) => {
    const totals = calculateInvoiceTotals(inv.lineItems);
    return [
      inv.invoiceNumber,
      inv.documentType,
      `"${inv.clientName.replace(/"/g, '""')}"`,
      inv.clientTaxNumber ?? "",
      inv.issueDate,
      inv.dueDate,
      inv.status,
      inv.currency,
      totals.subtotal.toFixed(2),
      totals.vatTotal.toFixed(2),
      totals.totalAmount.toFixed(2),
      inv.lineItems.length,
    ].join(",");
  });

  return [header, ...rows].join("\n");
}
