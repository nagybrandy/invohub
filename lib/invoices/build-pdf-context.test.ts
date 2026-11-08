// lib/invoices/build-pdf-context.test.ts
jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn(),
}));

jest.mock("@/lib/invoices/pdf-template/service", () => ({
  getPdfTemplate: jest.fn(),
  getLegacyAppearance: jest.fn(),
  getInvoicePdfTemplateSnapshot: jest.fn(),
}));

jest.mock("@/lib/clients/service", () => ({
  getClientById: jest.fn(),
}));

jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
}));

import { getCompanyByUserId } from "@/lib/companies/service";
import { buildInvoicePdfContext } from "@/lib/invoices/build-pdf-context";
import {
  getInvoicePdfTemplateSnapshot,
  getLegacyAppearance,
  getPdfTemplate,
} from "@/lib/invoices/pdf-template/service";
import { DEFAULT_PDF_TEMPLATE, LEGACY_PDF_TEMPLATE } from "@/lib/invoices/pdf-template/defaults";
import { getClientById } from "@/lib/clients/service";
import { getInvoiceById } from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockCompany = getCompanyByUserId as jest.MockedFunction<typeof getCompanyByUserId>;
const mockTemplate = getPdfTemplate as jest.MockedFunction<typeof getPdfTemplate>;
const mockLegacy = getLegacyAppearance as jest.MockedFunction<typeof getLegacyAppearance>;
const mockSnapshot = getInvoicePdfTemplateSnapshot as jest.MockedFunction<typeof getInvoicePdfTemplateSnapshot>;
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
      ...DEFAULT_PDF_TEMPLATE,
      accentColor: "#000000",
      footerText: "",
      notesLabel: "Notes",
    });
    mockLegacy.mockResolvedValue({ ...LEGACY_PDF_TEMPLATE, accentColor: "#000000", notesLabel: "Notes" });
    mockSnapshot.mockResolvedValue(null);
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

  it("prefers the invoice's own buyer-address snapshot over the linked client, without querying it", async () => {
    const ctx = await buildInvoicePdfContext(
      "u1",
      makeInvoice({
        clientId: "cl1",
        clientZipCode: "9021",
        clientCity: "Győr",
        clientAddress: "Fő utca 1.",
        clientCountry: "Magyarország",
        clientEuVatNumber: "HU12345678",
      })
    );
    expect(mockClient).not.toHaveBeenCalled();
    expect(ctx.buyer).toEqual({
      address: "Fő utca 1.",
      city: "Győr",
      zipCode: "9021",
      country: "Magyarország",
      euVatNumber: "HU12345678",
    });
  });

  it("falls back to the linked client when the invoice snapshot is entirely empty (legacy invoice)", async () => {
    mockClient.mockResolvedValue({
      id: "cl1",
      userId: "u1",
      name: "Duna Kft.",
      address: "Régi utca 2.",
      city: "Győr",
      zipCode: "9021",
      country: "Magyarország",
      createdAt: "",
      updatedAt: "",
    } as never);
    const ctx = await buildInvoicePdfContext(
      "u1",
      makeInvoice({
        clientId: "cl1",
        clientZipCode: undefined,
        clientCity: undefined,
        clientAddress: undefined,
      })
    );
    expect(mockClient).toHaveBeenCalledWith("u1", "cl1");
    expect(ctx.buyer?.address).toBe("Régi utca 2.");
  });

  it("resolves the referenced original invoice number for a helyesbítő / storno (Áfa tv. 170. §)", async () => {
    (getInvoiceById as jest.Mock).mockResolvedValue(makeInvoice({ id: "orig", invoiceNumber: "INV-2026-000147" }));
    const modify = await buildInvoicePdfContext("u1", makeInvoice({ documentType: "modify", modifiesInvoiceId: "orig" }));
    expect(modify.referencedInvoiceNumber).toBe("INV-2026-000147");
    expect(getInvoiceById).toHaveBeenCalledWith("u1", "orig");

    const storno = await buildInvoicePdfContext("u1", makeInvoice({ documentType: "storno", originalInvoiceId: "orig" }));
    expect(storno.referencedInvoiceNumber).toBe("INV-2026-000147");
  });

  it("does not look anything up for a plain invoice", async () => {
    (getInvoiceById as jest.Mock).mockClear();
    const ctx = await buildInvoicePdfContext("u1", makeInvoice({ documentType: "invoice" }));
    expect(ctx.referencedInvoiceNumber).toBeUndefined();
    expect(getInvoiceById).not.toHaveBeenCalled();
  });

  describe("appearance (PDF template) of an issued invoice", () => {
    const LEGACY_LAYOUT = {
      layout: "legacy" as const,
      fontStyle: "invohub" as const,
      logoMode: "monogram" as const,
      logoSize: "M" as const,
      logoPosition: "left" as const,
    };
    const ISSUED_LOOK = {
      titleText: "RÉGI SZÁMLA",
      accentColor: "#ff0000",
      showCompanyBlock: false,
      showBankDetails: false,
      showClientTaxNumber: false,
      footerText: "Kiállításkori lábléc",
      notesLabel: "Megj.",
      fontScale: "large" as const,
      ...LEGACY_LAYOUT,
    };

    it("renders an issued invoice with the appearance frozen at issue time, not the user's current template", async () => {
      mockSnapshot.mockResolvedValue(ISSUED_LOOK);
      const ctx = await buildInvoicePdfContext("u1", makeInvoice({ id: "inv-9", status: "unpaid" }));
      expect(mockSnapshot).toHaveBeenCalledWith("u1", "inv-9");
      expect(ctx.template).toEqual(ISSUED_LOOK);
    });

    it("renders an issued invoice that has no snapshot with the LEGACY appearance, never the live paper template", async () => {
      const ctx = await buildInvoicePdfContext("u1", makeInvoice({ status: "paid" }));
      expect(mockLegacy).toHaveBeenCalledWith("u1");
      expect(mockTemplate).not.toHaveBeenCalled();
      expect(ctx.template?.layout).toBe("legacy");
      expect(ctx.template).toEqual(await mockLegacy.mock.results[0]!.value);
    });

    it("keeps a snapshot whose layout is legacy exactly as stored (not resolved to clean), without consulting the live template", async () => {
      mockSnapshot.mockResolvedValue(ISSUED_LOOK);
      const ctx = await buildInvoicePdfContext("u1", makeInvoice({ status: "unpaid" }));
      expect(ctx.template?.layout).toBe("legacy");
      expect(mockTemplate).not.toHaveBeenCalled();
    });

    it("keeps a new-shape snapshot as it is", async () => {
      const newLook = { ...DEFAULT_PDF_TEMPLATE, layout: "band" as const };
      mockSnapshot.mockResolvedValue(newLook);
      const ctx = await buildInvoicePdfContext("u1", makeInvoice({ status: "sent" }));
      expect(ctx.template).toEqual(newLook);
      expect(mockLegacy).not.toHaveBeenCalled();
    });

    it("renders a draft with the live template (Dóri's design) and never looks up a snapshot", async () => {
      const ctx = await buildInvoicePdfContext("u1", makeInvoice({ status: "draft", invoiceNumber: "" }));
      expect(mockSnapshot).not.toHaveBeenCalled();
      expect(mockLegacy).not.toHaveBeenCalled();
      expect(ctx.template?.layout).toBe("clean");
    });
  });
});
