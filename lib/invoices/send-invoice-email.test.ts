// lib/invoices/send-invoice-email.test.ts
jest.mock("@/lib/invoices/generate-pdf", () => ({
  invoicePdfFilename: jest.fn((invoiceNumber: string) => `${invoiceNumber}.pdf`),
}));

jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
  upsertInvoice: jest.fn(),
}));

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

import { getCompanyByUserId, resolveInvoiceEmailRecipients } from "@/lib/companies/service";
import { sendEmail } from "@/lib/email/send";
import { getEmailTemplateByType } from "@/lib/email/templates/service";
import { buildInvoicePdfForUser } from "@/lib/invoices/invoice-pdf";
import { sendInvoiceNotificationEmail } from "@/lib/invoices/send-invoice-email";
import { getInvoiceById, upsertInvoice } from "@/lib/invoices/service";
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
    const invoice = makeInvoice({ status: "draft" });
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
    const draft = makeInvoice({ status: "draft", invoiceNumber: "" });
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
    const draft = makeInvoice({ status: "draft", invoiceNumber: "" });
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
});
