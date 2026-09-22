// lib/invoices/send-invoice-email.test.ts
jest.mock("@/lib/invoices/generate-pdf", () => ({
  invoicePdfFilename: jest.fn((invoiceNumber: string) => `${invoiceNumber}.pdf`),
}));

jest.mock("@/lib/invoices/service", () => {
  class CompanyProfileIncompleteError extends Error {
    missingFields: string[];
    constructor(missingFields: string[]) {
      super("Company profile is incomplete.");
      this.name = "CompanyProfileIncompleteError";
      this.missingFields = missingFields;
    }
  }
  return {
    getInvoiceById: jest.fn(),
    upsertInvoice: jest.fn(),
    CompanyProfileIncompleteError,
  };
});

jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn(),
  resolveInvoiceEmailRecipients: jest.fn(),
}));

jest.mock("@/lib/email/templates/service", () => ({
  getEmailTemplateByType: jest.fn(),
}));

jest.mock("@/lib/invoices/invoice-pdf", () => ({
  buildInvoicePdfForUser: jest.fn(),
}));

jest.mock("@/lib/email/send", () => ({
  sendEmail: jest.fn(),
}));

const mockAutoSubmit = jest.fn();
jest.mock("@/lib/nav/auto-submit", () => ({
  autoSubmitToNavOnFinalize: (...args: unknown[]) => mockAutoSubmit(...args),
}));

import { getCompanyByUserId, resolveInvoiceEmailRecipients } from "@/lib/companies/service";
import { sendEmail } from "@/lib/email/send";
import { getEmailTemplateByType } from "@/lib/email/templates/service";
import { buildInvoicePdfForUser } from "@/lib/invoices/invoice-pdf";
import { sendInvoiceNotificationEmail } from "@/lib/invoices/send-invoice-email";
import { CompanyProfileIncompleteError, getInvoiceById, upsertInvoice } from "@/lib/invoices/service";
import { InvoiceAlreadyFinalizedError } from "@/lib/invoices/errors";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockGetInvoice = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockResolveRecipients = resolveInvoiceEmailRecipients as jest.MockedFunction<
  typeof resolveInvoiceEmailRecipients
>;
const mockGetTemplate = getEmailTemplateByType as jest.MockedFunction<typeof getEmailTemplateByType>;
const mockBuildPdf = buildInvoicePdfForUser as jest.MockedFunction<typeof buildInvoicePdfForUser>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockGetCompany = getCompanyByUserId as jest.MockedFunction<typeof getCompanyByUserId>;
const mockUpsert = upsertInvoice as jest.MockedFunction<typeof upsertInvoice>;

describe("sendInvoiceNotificationEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAutoSubmit.mockResolvedValue(null);
  });

  it("auto-submits to NAV when sending finalizes a draft (before -> after)", async () => {
    const draft = makeInvoice({ status: "draft", invoiceNumber: "", clientZipCode: "1011", clientCity: "Budapest", clientAddress: "Fő utca 1." });
    const finalized = makeInvoice({ status: "sent", invoiceNumber: "INV-2026-007" });
    mockGetInvoice.mockResolvedValue(draft);
    mockUpsert.mockResolvedValue(finalized);
    // A recipient + complete buyer address are both checked before the
    // draft is finalized (never burn a number on a send that can't happen).
    mockResolveRecipients.mockResolvedValue(["buyer@example.com"]);

    await sendInvoiceNotificationEmail("user-1", draft.id);

    expect(mockAutoSubmit).toHaveBeenCalledWith("user-1", draft, finalized);
  });

  it("does not touch NAV when the invoice was already final", async () => {
    mockGetInvoice.mockResolvedValue(makeInvoice({ status: "unpaid" }));
    mockResolveRecipients.mockResolvedValue([]);

    await sendInvoiceNotificationEmail("user-1", "inv-1");

    expect(mockAutoSubmit).not.toHaveBeenCalled();
  });

  it("returns a companyProfileIncomplete failure instead of throwing when finalizing a draft fails", async () => {
    const invoice = makeInvoice({ status: "draft", clientZipCode: "1011", clientCity: "Budapest", clientAddress: "Fő utca 1." });
    mockGetInvoice.mockResolvedValue(invoice);
    mockResolveRecipients.mockResolvedValue(["buyer@example.com"]);
    mockUpsert.mockRejectedValue(new CompanyProfileIncompleteError(["taxNumber", "address"]));

    const result = await sendInvoiceNotificationEmail("user-1", invoice.id);

    expect(result.ok).toBe(false);
    expect(result.code).toBe("companyProfileIncomplete");
    expect(result.missingFields).toEqual(["taxNumber", "address"]);
    expect(mockBuildPdf).not.toHaveBeenCalled();
  });

  it("returns an invoiceFinalized failure (no email, no NAV) when a concurrent request finalized the draft first", async () => {
    const invoice = makeInvoice({ status: "draft", invoiceNumber: "", clientZipCode: "1011", clientCity: "Budapest", clientAddress: "Fő utca 1." });
    mockGetInvoice.mockResolvedValue(invoice);
    mockResolveRecipients.mockResolvedValue(["buyer@example.com"]);
    mockUpsert.mockRejectedValue(new InvoiceAlreadyFinalizedError("INV-2026-00001"));

    const result = await sendInvoiceNotificationEmail("user-1", invoice.id);

    expect(result.ok).toBe(false);
    expect(result.code).toBe("invoiceFinalized");
    expect(mockBuildPdf).not.toHaveBeenCalled();
    expect(mockAutoSubmit).not.toHaveBeenCalled();
  });

  it("returns error when recipient cannot be resolved", async () => {
    const invoice = makeInvoice();
    mockGetInvoice.mockResolvedValue(invoice);
    mockResolveRecipients.mockResolvedValue([]);

    const result = await sendInvoiceNotificationEmail("user-1", invoice.id);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/recipient/i);
  });

  it("sends email with pdf attachment", async () => {
    const invoice = makeInvoice({ status: "draft", clientZipCode: "1011", clientCity: "Budapest", clientAddress: "Fő utca 1." });
    mockGetInvoice.mockResolvedValue(invoice);
    mockResolveRecipients.mockResolvedValue(["bendeguznagy55@gmail.com"]);
    mockGetTemplate.mockResolvedValue({
      id: "tpl-1",
      userId: "user-1",
      type: "invoice_notification",
      subject: "Invoice {{invoiceNumber}}",
      bodyHtml: "<p>{{clientName}}</p>",
      bodyText: "{{clientName}}",
      createdAt: "",
      updatedAt: "",
    });
    mockBuildPdf.mockResolvedValue({
      pdf: Buffer.from("%PDF"),
      invoiceNumber: invoice.invoiceNumber,
    });
    mockGetCompany.mockResolvedValue({
      id: "c1",
      userId: "user-1",
      name: "Demo Kft.",
      invoiceEmailCc: "cc@example.com",
      createdAt: "",
      updatedAt: "",
    });
    mockSendEmail.mockResolvedValue({ ok: true });
    mockUpsert.mockResolvedValue({ ...invoice, status: "sent" });

    const result = await sendInvoiceNotificationEmail("user-1", invoice.id);

    expect(result.ok).toBe(true);
    expect(result.to).toEqual(["bendeguznagy55@gmail.com"]);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["bendeguznagy55@gmail.com"],
        cc: ["cc@example.com"],
      })
    );
  });

  it("finalizes (assigns a number) a draft BEFORE building the PDF, not after sending", async () => {
    const draft = makeInvoice({ status: "draft", invoiceNumber: "", clientZipCode: "1011", clientCity: "Budapest", clientAddress: "Fő utca 1." });
    const finalized = { ...draft, status: "sent" as const, invoiceNumber: "INV-2026-042" };

    mockGetInvoice.mockResolvedValue(draft);
    mockUpsert.mockResolvedValue(finalized);
    mockResolveRecipients.mockResolvedValue(["client@example.com"]);
    mockGetTemplate.mockResolvedValue({
      id: "tpl-1",
      userId: "user-1",
      type: "invoice_notification",
      subject: "Invoice {{invoiceNumber}}",
      bodyHtml: "<p>{{clientName}}</p>",
      bodyText: "{{clientName}}",
      createdAt: "",
      updatedAt: "",
    });
    mockBuildPdf.mockResolvedValue({ pdf: Buffer.from("%PDF"), invoiceNumber: "INV-2026-042" });
    mockGetCompany.mockResolvedValue(null);
    mockSendEmail.mockResolvedValue({ ok: true });

    const callOrder: string[] = [];
    mockUpsert.mockImplementation(async () => {
      callOrder.push("upsert");
      return finalized;
    });
    mockBuildPdf.mockImplementation(async () => {
      callOrder.push("buildPdf");
      return { pdf: Buffer.from("%PDF"), invoiceNumber: "INV-2026-042" };
    });

    const result = await sendInvoiceNotificationEmail("user-1", draft.id);

    expect(callOrder).toEqual(["upsert", "buildPdf"]);
    expect(mockUpsert).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ status: "sent" })
    );
    expect(result.invoice?.invoiceNumber).toBe("INV-2026-042");
  });

  it("skips the finalize step when markSent is false", async () => {
    const draft = makeInvoice({ status: "draft", invoiceNumber: "", clientZipCode: "1011", clientCity: "Budapest", clientAddress: "Fő utca 1." });
    mockGetInvoice.mockResolvedValue(draft);
    mockResolveRecipients.mockResolvedValue(["client@example.com"]);
    mockGetTemplate.mockResolvedValue({
      id: "tpl-1",
      userId: "user-1",
      type: "invoice_notification",
      subject: "Invoice {{invoiceNumber}}",
      bodyHtml: "<p>{{clientName}}</p>",
      bodyText: "{{clientName}}",
      createdAt: "",
      updatedAt: "",
    });
    mockBuildPdf.mockResolvedValue({ pdf: Buffer.from("%PDF"), invoiceNumber: "" });
    mockGetCompany.mockResolvedValue(null);
    mockSendEmail.mockResolvedValue({ ok: true });

    const result = await sendInvoiceNotificationEmail("user-1", draft.id, { markSent: false });

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(result.invoice?.status).toBe("draft");
  });

  it("sends to multiple recipients when provided", async () => {
    const invoice = makeInvoice({ status: "sent" });
    mockGetInvoice.mockResolvedValue(invoice);
    mockResolveRecipients.mockResolvedValue(["a@x.com", "b@x.com"]);
    mockGetTemplate.mockResolvedValue({
      id: "tpl-1",
      userId: "user-1",
      type: "invoice_notification",
      subject: "Invoice {{invoiceNumber}}",
      bodyHtml: "<p>{{clientName}}</p>",
      bodyText: "{{clientName}}",
      createdAt: "",
      updatedAt: "",
    });
    mockBuildPdf.mockResolvedValue({
      pdf: Buffer.from("%PDF"),
      invoiceNumber: invoice.invoiceNumber,
    });
    mockGetCompany.mockResolvedValue(null);
    mockSendEmail.mockResolvedValue({ ok: true });

    const result = await sendInvoiceNotificationEmail("user-1", invoice.id, {
      to: ["a@x.com", "b@x.com"],
      cc: ["cc@x.com"],
    });

    expect(result.ok).toBe(true);
    expect(result.to).toEqual(["a@x.com", "b@x.com"]);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["a@x.com", "b@x.com"],
        cc: ["cc@x.com"],
      })
    );
  });

  it("never assigns a number when there is no recipient (a failed send must not burn a sorszám)", async () => {
    const invoice = makeInvoice({ status: "draft", clientZipCode: "1011", clientCity: "Budapest", clientAddress: "Fő utca 1." });
    mockGetInvoice.mockResolvedValue(invoice);
    mockResolveRecipients.mockResolvedValue([]);

    const result = await sendInvoiceNotificationEmail("user-1", invoice.id);

    expect(result).toMatchObject({ ok: false, code: "noRecipient" });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("refuses to finalize a draft without a buyer address (Áfa tv. 169. § e)", async () => {
    const invoice = makeInvoice({ status: "draft", clientZipCode: undefined, clientCity: undefined, clientAddress: undefined });
    mockGetInvoice.mockResolvedValue(invoice);
    mockResolveRecipients.mockResolvedValue(["buyer@example.com"]);

    const result = await sendInvoiceNotificationEmail("user-1", invoice.id);

    expect(result).toMatchObject({ ok: false, code: "buyerAddressMissing" });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("does not require a buyer address to e-mail a proforma (díjbekérő)", async () => {
    const invoice = makeInvoice({ status: "draft", documentType: "proforma", clientZipCode: undefined, clientCity: undefined, clientAddress: undefined });
    mockGetInvoice.mockResolvedValue(invoice);
    mockResolveRecipients.mockResolvedValue(["buyer@example.com"]);
    mockUpsert.mockRejectedValue(new Error("stop here"));

    await expect(sendInvoiceNotificationEmail("user-1", invoice.id)).rejects.toThrow("stop here");
    expect(mockUpsert).toHaveBeenCalled();
  });
});
