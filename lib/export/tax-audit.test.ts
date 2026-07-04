// lib/export/tax-audit.test.ts
import { generateTaxAuditExport } from "@/lib/export/tax-audit";
import { listInvoices } from "@/lib/invoices/service";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

jest.mock("@/lib/invoices/service", () => ({
  listInvoices: jest.fn(),
}));

const mockListInvoices = listInvoices as jest.MockedFunction<typeof listInvoices>;

describe("generateTaxAuditExport", () => {
  beforeEach(() => {
    mockListInvoices.mockResolvedValue({
      invoices: [
        makeInvoice({
          issueDate: "2026-05-01",
          lineItems: [makeLineItem({ quantity: 1, unitPrice: 100, vatRate: 27 })],
        }),
        makeInvoice({
          id: "inv-2",
          invoiceNumber: "INV-2026-002",
          issueDate: "2026-07-01",
        }),
      ],
      total: 2,
      limit: 100,
      offset: 0,
    });
  });

  it("filters by date range and outputs CSV header", async () => {
    const csv = await generateTaxAuditExport("user-1", "2026-01-01", "2026-06-30");
    const lines = csv.split("\n");
    expect(lines[0]).toContain("invoice_number");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("INV-2026-001");
  });

  it("escapes quotes in client name", async () => {
    mockListInvoices.mockResolvedValue({
      invoices: [makeInvoice({ clientName: 'Acme "Best" Kft.', issueDate: "2026-05-01" })],
      total: 1,
      limit: 100,
      offset: 0,
    });
    const csv = await generateTaxAuditExport("user-1", "2026-01-01", "2026-12-31");
    expect(csv).toContain('"Acme ""Best"" Kft."');
  });
});
