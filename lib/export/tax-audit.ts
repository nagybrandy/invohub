// lib/export/tax-audit.ts
// Generates CSV bundle for tax authority audit export.
import { INVOICE_LIST_MAX_LIMIT } from "@/lib/invoices/constants";
import { listInvoices } from "@/lib/invoices/service";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";

export async function generateTaxAuditExport(
  userId: string,
  from: string,
  to: string
): Promise<string> {
  const { invoices } = await listInvoices(userId, { limit: INVOICE_LIST_MAX_LIMIT });
  const filtered = invoices.filter(
    (inv) => inv.issueDate >= from && inv.issueDate <= to
  );

  const header =
    "invoice_number,client_name,client_tax_number,issue_date,due_date,status,currency,subtotal,vat,total,line_items_count";
  const rows = filtered.map((inv) => {
    const totals = calculateInvoiceTotals(inv.lineItems);
    return [
      inv.invoiceNumber,
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
