// lib/invoices/invoice-pdf.test.ts
jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
}));

jest.mock("@/lib/invoices/build-pdf-context", () => ({
  buildInvoicePdfContext: jest.fn(),
}));

jest.mock("@/lib/invoices/generate-pdf", () => ({
  generateInvoicePdf: jest.fn(),
}));

import { buildInvoicePdfContext } from "@/lib/invoices/build-pdf-context";
import { generateInvoicePdf } from "@/lib/invoices/generate-pdf";
import { buildInvoicePdfForUser } from "@/lib/invoices/invoice-pdf";
import { getInvoiceById } from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockGetInvoice = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockBuildContext = buildInvoicePdfContext as jest.MockedFunction<
  typeof buildInvoicePdfContext
>;
const mockGeneratePdf = generateInvoicePdf as jest.MockedFunction<typeof generateInvoicePdf>;

describe("buildInvoicePdfForUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when invoice missing", async () => {
    mockGetInvoice.mockResolvedValue(null);
    const result = await buildInvoicePdfForUser("user-1", "inv-1");
    expect(result).toBeNull();
  });

  it("generates pdf with user context", async () => {
    const invoice = makeInvoice();
    const ctx = {
      invoice,
      company: { name: "Demo Kft.", taxNumber: "12345678-2-41" },
      template: { titleText: "INVOICE" },
    };
    mockGetInvoice.mockResolvedValue(invoice);
    mockBuildContext.mockResolvedValue(ctx as never);
    mockGeneratePdf.mockResolvedValue(Buffer.from("%PDF-test"));

    const result = await buildInvoicePdfForUser("user-1", invoice.id);

    expect(result?.invoiceNumber).toBe(invoice.invoiceNumber);
    expect(mockBuildContext).toHaveBeenCalledWith("user-1", invoice);
    expect(mockGeneratePdf).toHaveBeenCalledWith(ctx);
  });
});
