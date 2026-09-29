// lib/invoices/client-form-fields.ts
// Maps saved clients into new-invoice form fields and bill-to preview text.
import type { Client } from "@/lib/clients/service";

export type InvoiceClientFormFields = {
  clientId: string | null;
  clientName: string;
  clientTaxNumber: string;
  clientEmail: string;
  clientCountry: string;
  clientZip: string;
  clientCity: string;
  clientAddress: string;
  /** EU VAT number snapshot — carried through when a saved client is picked, no dedicated composer input yet. */
  clientEuVatNumber: string;
};

export function emptyClientFormFields(
  defaults: Partial<InvoiceClientFormFields> = {},
): InvoiceClientFormFields {
  return {
    clientId: null,
    clientName: "",
    clientTaxNumber: "",
    clientEmail: "",
    clientCountry: "Magyarország",
    clientZip: "",
    clientCity: "",
    clientAddress: "",
    clientEuVatNumber: "",
    ...defaults,
  };
}

export function applyClientToFormFields(client: Client): InvoiceClientFormFields {
  return {
    clientId: client.id,
    clientName: client.name,
    clientTaxNumber: client.taxNumber ?? "",
    clientEmail: client.email ?? "",
    clientCountry: client.country?.trim() || "Magyarország",
    clientZip: client.zipCode ?? "",
    clientCity: client.city ?? "",
    clientAddress: client.address ?? "",
    clientEuVatNumber: client.euVatNumber ?? "",
  };
}

export function formatClientBillToLines(fields: InvoiceClientFormFields): string[] {
  const lines: string[] = [];
  const addressLine = [fields.clientZip, fields.clientCity, fields.clientAddress]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  if (addressLine) {
    lines.push(addressLine);
  }
  if (fields.clientCountry.trim() && fields.clientCountry.trim() !== "Magyarország") {
    lines.push(fields.clientCountry.trim());
  }
  if (fields.clientEmail.trim()) {
    lines.push(fields.clientEmail.trim());
  }
  return lines;
}

export type InvoiceMetaNotesInput = {
  userNotes?: string;
  paymentMethod?: string;
  bankAccount?: string;
  billToLines?: string[];
};

/**
 * Append structured meta into invoice.notes so PDF/email keep the context
 * without a schema migration. No longer appends a "Teljesítés: …" line —
 * fulfillmentDate is a real column now (db/schema.ts, lib/invoices/types.ts)
 * printed from its own field; see lib/invoices/fulfillment-date.ts for the
 * read-time fallback that still parses that line out of pre-migration rows.
 */
export function composeInvoiceNotes(input: InvoiceMetaNotesInput): string | undefined {
  const blocks: string[] = [];
  const userNotes = input.userNotes?.trim();
  if (userNotes) {
    blocks.push(userNotes);
  }

  const meta: string[] = [];
  if (input.paymentMethod?.trim()) {
    meta.push(`Fizetés: ${input.paymentMethod.trim()}`);
  }
  if (input.bankAccount?.trim()) {
    meta.push(`Bankszámla: ${input.bankAccount.trim()}`);
  }
  if (input.billToLines && input.billToLines.length > 0) {
    meta.push(`Számlázási cím:\n${input.billToLines.join("\n")}`);
  }
  if (meta.length > 0) {
    blocks.push(meta.join("\n"));
  }

  const joined = blocks.join("\n\n").trim();
  return joined.length > 0 ? joined : undefined;
}
