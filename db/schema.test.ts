// db/schema.test.ts
// Sanity-checks that the schema module (table/column/index definitions)
// loads without throwing and exposes the columns the invoicing track added.
// db/schema.ts needs no DATABASE_URL — only db/index.ts does — so this
// imports the real module, not a mock.
import { company, documentSequence, invoice, invoiceLineItem, schema } from "@/db/schema";

describe("db/schema", () => {
  it("registers document_sequence on the shared schema object", () => {
    expect(schema.documentSequence).toBe(documentSequence);
  });

  it("gives company a vatExempt column", () => {
    expect(company.vatExempt).toBeDefined();
  });

  it("gives invoice the new numbering/payment/correction columns", () => {
    expect(invoice.documentType).toBeDefined();
    expect(invoice.exchangeRate).toBeDefined();
    expect(invoice.paymentMethod).toBeDefined();
    expect(invoice.paidAt).toBeDefined();
    expect(invoice.paidAmount).toBeDefined();
    expect(invoice.originalInvoiceId).toBeDefined();
    expect(invoice.modifiesInvoiceId).toBeDefined();
    expect(invoice.modificationIndex).toBeDefined();
  });

  it("defaults invoice.currency to HUF and invoice.invoiceNumber to blank", () => {
    expect(invoice.currency.default).toBe("HUF");
    expect(invoice.invoiceNumber.default).toBe("");
    expect(invoice.invoiceNumber.notNull).toBe(true);
  });

  it("gives invoiceLineItem VAT category columns", () => {
    expect(invoiceLineItem.vatCategory).toBeDefined();
    expect(invoiceLineItem.vatCategory.default).toBe("normal");
    expect(invoiceLineItem.vatExemptionReason).toBeDefined();
  });

  it("gives document_sequence its counter columns", () => {
    expect(documentSequence.userId).toBeDefined();
    expect(documentSequence.docType).toBeDefined();
    expect(documentSequence.year).toBeDefined();
    expect(documentSequence.lastNumber).toBeDefined();
  });
});
