// lib/invoices/errors.ts
// Small, dependency-free error types shared between lib/invoices/service
// modules and the API routes that translate them into HTTP responses.
// Kept out of create-from-payload.ts (which pulls in @/db transitively via
// lib/companies/service) so route tests can import the class directly
// without needing to requireActual the DB-touching module (tests must
// never require a live Postgres connection — see AGENTS.md §9 / CLAUDE.md).

/**
 * Thrown by createInvoiceFromPayload when a non-draft create is requested
 * without a complete buyer name+address — distinguished from the generic
 * validation Error (400) so the route can respond 422 with
 * `code: "buyerAddressMissing"` (see app/api/v1/invoices+api.ts).
 */
export class BuyerAddressMissingError extends Error {
  readonly code = "buyerAddressMissing" as const;
  constructor() {
    super(
      "Buyer name and address (clientZipCode, clientCity, clientAddress) are required to finalize an invoice."
    );
    this.name = "BuyerAddressMissingError";
  }
}

/**
 * Thrown by upsertInvoice when a document that already carries an issued
 * number (status off "draft" + non-blank invoiceNumber) would be assigned a
 * second one — either the caller lost the number, or (the race this guards)
 * another request finalized the same draft between our read and our write.
 * Continuous numbering means a document gets exactly one number, ever.
 */
export class InvoiceAlreadyFinalizedError extends Error {
  readonly code = "invoiceFinalized" as const;
  readonly invoiceNumber: string;

  constructor(invoiceNumber: string) {
    super("This invoice is already finalized and numbered.");
    this.name = "InvoiceAlreadyFinalizedError";
    this.invoiceNumber = invoiceNumber;
  }
}
