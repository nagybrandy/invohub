// lib/invoices/build-pdf-context.test.ts
jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn(),
}));

jest.mock("@/lib/invoices/pdf-template/service", () => ({
  getPdfTemplate: jest.fn(),
}));

jest.mock("@/lib/clients/service", () => ({
  getClientById: jest.fn(),
}));

import { getCompanyByUserId } from "@/lib/companies/service";
import { buildInvoicePdfContext } from "@/lib/invoices/build-pdf-context";
import { getPdfTemplate } from "@/lib/invoices/pdf-template/service";
import { getClientById } from "@/lib/clients/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockCompany = getCompanyByUserId as jest.MockedFunction<typeof getCompanyByUserId>;
const mockTemplate = getPdfTemplate as jest.MockedFunction<typeof getPdfTemplate>;
const mockClient = getClientById as jest.MockedFunction<typeof getClientById>;

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

  it("loads the buyer's address from the linked partner so the document can print it (Áfa tv. 169. § e)", async () => {
    mockClient.mockResolvedValue({
      id: "cl1",
      userId: "u1",
      name: "Duna Kft.",
      address: "Fő utca 1.",
      city: "Győr",
      zipCode: "9021",
      country: "Magyarország",
      euVatNumber: "HU12345678",
      createdAt: "",
      updatedAt: "",
    } as never);
    const ctx = await buildInvoicePdfContext("u1", makeInvoice({ clientId: "cl1" }));
    expect(mockClient).toHaveBeenCalledWith("u1", "cl1");
    expect(ctx.buyer).toEqual({
      address: "Fő utca 1.",
      city: "Győr",
      zipCode: "9021",
      country: "Magyarország",
      euVatNumber: "HU12345678",
    });
  });

  it("does not look up a partner and leaves buyer undefined when the invoice has no clientId", async () => {
    const ctx = await buildInvoicePdfContext("u1", makeInvoice({ clientId: undefined }));
    expect(mockClient).not.toHaveBeenCalled();
    expect(ctx.buyer).toBeUndefined();
  });

  it("leaves buyer undefined when the linked partner no longer exists", async () => {
    mockClient.mockResolvedValue(null);
    const ctx = await buildInvoicePdfContext("u1", makeInvoice({ clientId: "gone" }));
    expect(ctx.buyer).toBeUndefined();
  });
});
