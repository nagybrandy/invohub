// lib/bulk/run.ts
// Creates the validated bulk rows one after another through the same API the
// forms use. Drafts by default; "issue now" numbers them (and, in a NAV mode,
// reports them) one by one — so it stops being a bulk-undo-able action, which
// is why the screen asks for confirmation first.
import type { BulkInvoiceRow, BulkReceiptRow, BulkRowResult } from "@/lib/bulk/validate";
import type { Client, ClientInput } from "@/lib/clients/service";
import { createId } from "@/lib/id";
import { partnerToRemember } from "@/lib/invoices/remember-entities";
import type { Invoice } from "@/lib/invoices/types";

export function invoiceFromBulkRow(row: BulkInvoiceRow, opts: { issueNow: boolean; clientId?: string; now?: Date }): Invoice {
  const now = (opts.now ?? new Date()).toISOString();
  const status = !opts.issueNow ? "draft" : row.kind === "proforma" ? "proforma" : "unpaid";
  return {
    id: createId(),
    invoiceNumber: "",
    documentType: row.kind,
    clientName: row.partner.name,
    clientTaxNumber: row.partner.taxNumber,
    clientZipCode: row.partner.zipCode,
    clientCity: row.partner.city,
    clientAddress: row.partner.address,
    clientCountry: row.partner.country,
    clientId: opts.clientId,
    issueDate: row.issueDate,
    fulfillmentDate: row.fulfillmentDate,
    dueDate: row.dueDate,
    status,
    currency: row.currency,
    exchangeRate: row.exchangeRate,
    lineItems: [{ id: createId(), ...row.lineItem }],
    notes: row.notes,
    paymentMethod: row.paymentMethod,
    language: row.language,
    createdAt: now,
    updatedAt: now,
  };
}

export function receiptBodyFromBulkRow(row: BulkReceiptRow) {
  return {
    currency: row.currency,
    paymentMethod: row.paymentMethod,
    language: row.language,
    lineItems: [row.lineItem],
  };
}

export type BulkRunDeps = {
  createInvoice: (invoice: Invoice) => Promise<Invoice>;
  createReceipt: (body: ReturnType<typeof receiptBodyFromBulkRow>) => Promise<{ receiptNumber: string }>;
  createClient: (input: ClientInput) => Promise<Client>;
  existingClients: Pick<Client, "id" | "name" | "taxNumber">[];
};

export type BulkRunOutcome = {
  row: number;
  ok: boolean;
  /** Invoice number / receipt number when issued, "" for a draft. */
  number?: string;
  error?: string;
};

export async function runBulk(
  results: BulkRowResult[],
  opts: { issueNow: boolean },
  deps: BulkRunDeps,
  onProgress?: (done: number, total: number) => void,
): Promise<BulkRunOutcome[]> {
  const valid = results.filter((r) => r.errors.length === 0 && (r.invoice || r.receipt));
  const known = [...deps.existingClients];
  const outcomes: BulkRunOutcome[] = [];

  for (let i = 0; i < valid.length; i++) {
    const r = valid[i];
    try {
      if (r.receipt) {
        const created = await deps.createReceipt(receiptBodyFromBulkRow(r.receipt));
        outcomes.push({ row: r.row, ok: true, number: created.receiptNumber });
      } else if (r.invoice) {
        // Saving the partner is best effort: the document is what matters.
        let clientId: string | undefined;
        const toSave = partnerToRemember(
          { clientName: r.invoice.partner.name, clientTaxNumber: r.invoice.partner.taxNumber, clientEmail: r.invoice.partner.email,
            clientZipCode: r.invoice.partner.zipCode, clientCity: r.invoice.partner.city, clientAddress: r.invoice.partner.address,
            clientCountry: r.invoice.partner.country },
          known,
        );
        if (toSave) {
          try {
            const client = await deps.createClient(toSave);
            clientId = client.id;
            known.push({ id: client.id, name: client.name, taxNumber: client.taxNumber });
          } catch {
            /* keep going without the link */
          }
        } else {
          const match = known.find((c) => c.name.trim().toLowerCase() === r.invoice!.partner.name.trim().toLowerCase());
          clientId = match?.id;
        }
        const saved = await deps.createInvoice(invoiceFromBulkRow(r.invoice, { issueNow: opts.issueNow, clientId }));
        outcomes.push({ row: r.row, ok: true, number: saved.invoiceNumber });
      }
    } catch (e) {
      outcomes.push({ row: r.row, ok: false, error: e instanceof Error ? e.message : "failed" });
    }
    onProgress?.(i + 1, valid.length);
  }
  return outcomes;
}
