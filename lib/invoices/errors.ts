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
