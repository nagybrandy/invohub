// lib/import/parse-invoices.test.ts
import * as XLSX from "xlsx";
import { parseInvoiceSpreadsheet } from "@/lib/import/parse-invoices";

function buildSpreadsheetBuffer(rows: Record<string, unknown>[]): ArrayBuffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Invoices");
  const array = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return array.buffer.slice(array.byteOffset, array.byteOffset + array.byteLength);
}

describe("parseInvoiceSpreadsheet", () => {
  it("parses rows with snake_case columns", () => {
    const buffer = buildSpreadsheetBuffer([
      {
        client_name: "Acme Kft.",
        description: "Dev work",
        quantity: 10,
        unit_price: 50,
        vat_rate: 27,
        invoice_number: "IMP-001",
      },
    ]);
    const drafts = parseInvoiceSpreadsheet(buffer);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].clientName).toBe("Acme Kft.");
    expect(drafts[0].invoiceNumber).toBe("IMP-001");
    expect(drafts[0].status).toBe("draft");
    expect(drafts[0].lineItems[0].description).toBe("Dev work");
    expect(drafts[0].lineItems[0].quantity).toBe(10);
    expect(drafts[0].lineItems[0].unitPrice).toBe(50);
  });

  it("defaults unknown client and invalid VAT", () => {
    const buffer = buildSpreadsheetBuffer([
      { description: "Item", vat_rate: 99 },
    ]);
    const drafts = parseInvoiceSpreadsheet(buffer);
    expect(drafts[0].clientName).toBe("Unknown");
    expect(drafts[0].lineItems[0].vatRate).toBe(27);
    expect(drafts[0].invoiceNumber).toBe("IMPORT-1");
  });

  it("supports HUF currency column", () => {
    const buffer = buildSpreadsheetBuffer([{ currency: "HUF", description: "X" }]);
    expect(parseInvoiceSpreadsheet(buffer)[0].currency).toBe("HUF");
  });
});
