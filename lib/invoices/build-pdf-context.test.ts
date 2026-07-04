// lib/invoices/build-pdf-context.test.ts
jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn(),
}));

jest.mock("@/lib/invoices/pdf-template/service", () => ({
  getPdfTemplate: jest.fn(),
}));

import { getCompanyByUserId } from "@/lib/companies/service";
import { buildInvoicePdfContext } from "@/lib/invoices/build-pdf-context";
import { getPdfTemplate } from "@/lib/invoices/pdf-template/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockCompany = getCompanyByUserId as jest.MockedFunction<typeof getCompanyByUserId>;
const mockTemplate = getPdfTemplate as jest.MockedFunction<typeof getPdfTemplate>;

describe("buildInvoicePdfContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompany.mockResolvedValue({
      id: "c1",
      userId: "u1",
      name: "Demo Kft.",
      logoUrl: "https://example.com/logo.png",
      createdAt: "",
      updatedAt: "",
    });
    mockTemplate.mockResolvedValue({
      titleText: "SZÁMLA",
      accentColor: "#000000",
      showCompanyBlock: true,
      showBankDetails: true,
      showClientTaxNumber: true,
      footerText: "",
      notesLabel: "Notes",
      fontScale: "medium",
    });
  });

  it("loads company and template for invoice pdf", async () => {
    const invoice = makeInvoice();
    const ctx = await buildInvoicePdfContext("u1", invoice);

    expect(ctx.invoice).toBe(invoice);
    expect(ctx.company?.name).toBe("Demo Kft.");
    expect(ctx.company?.logoUrl).toBe("https://example.com/logo.png");
    expect(ctx.template?.titleText).toBe("SZÁMLA");
  });
});
