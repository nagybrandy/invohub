// lib/export/tax-audit.test.ts
import { generateTaxAuditExport } from "@/lib/export/tax-audit";
import { listInvoicesInDateRange } from "@/lib/invoices/service";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

jest.mock("@/lib/invoices/service", () => ({
  listInvoicesInDateRange: jest.fn(),
}));

const mockListInvoicesInDateRange = listInvoicesInDateRange as jest.MockedFunction<
  typeof listInvoicesInDateRange
>;

describe("generateTaxAuditExport", () => {
  it("passes the date range straight through to the SQL-filtered query (no client-side filtering)", async () => {
    mockListInvoicesInDateRange.mockResolvedValue([
      makeInvoice({
        issueDate: "2026-05-01",
        lineItems: [makeLineItem({ quantity: 1, unitPrice: 100, vatRate: 27 })],
      }),
    ]);

    const csv = await generateTaxAuditExport("user-1", "2026-01-01", "2026-06-30");

    expect(mockListInvoicesInDateRange).toHaveBeenCalledWith(
      "user-1",
      "2026-01-01",
      "2026-06-30"
    );
    const lines = csv.split("\n");
    expect(lines[0]).toContain("invoice_number");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("INV-2026-001");
  });

  it("exports every invoice the query returns, not just the first page", async () => {
    const many = Array.from({ length: 250 }, (_, i) =>
      makeInvoice({ id: `inv-${i}`, invoiceNumber: `INV-2026-${i}`, issueDate: "2026-03-01" })
    );
    mockListInvoicesInDateRange.mockResolvedValue(many);

    const csv = await generateTaxAuditExport("user-1", "2026-01-01", "2026-12-31");
    const lines = csv.split("\n");
    expect(lines).toHaveLength(251); // header + 250 rows
  });

  it("escapes quotes in client name", async () => {
    mockListInvoicesInDateRange.mockResolvedValue([
      makeInvoice({ clientName: 'Acme "Best" Kft.', issueDate: "2026-05-01" }),
    ]);
    const csv = await generateTaxAuditExport("user-1", "2026-01-01", "2026-12-31");
    expect(csv).toContain('"Acme ""Best"" Kft."');
  });

  it("includes documentType in the header and rows", async () => {
    mockListInvoicesInDateRange.mockResolvedValue([
      makeInvoice({ documentType: "storno", issueDate: "2026-05-01" }),
    ]);
    const csv = await generateTaxAuditExport("user-1", "2026-01-01", "2026-12-31");
    expect(csv.split("\n")[0]).toContain("document_type");
    expect(csv).toContain("storno");
  });
});
