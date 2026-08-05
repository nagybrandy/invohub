// lib/receipts/send-receipt-email.test.ts
import { sendReceiptEmail } from "@/lib/receipts/send-receipt-email";

jest.mock("@/lib/receipts/service", () => ({
  getReceiptById: jest.fn(),
}));

jest.mock("@/lib/companies/service", () => ({
  getCompanyByUserId: jest.fn(),
}));

jest.mock("@/lib/email/send", () => ({
  sendEmail: jest.fn(),
}));

const { getReceiptById } = require("@/lib/receipts/service");
const { getCompanyByUserId } = require("@/lib/companies/service");
const { sendEmail } = require("@/lib/email/send");

const sampleReceipt = {
  id: "r1",
  userId: "u1",
  receiptNumber: "NYG-2026-001",
  totalAmount: 5000,
  currency: "HUF",
  paymentMethod: "cash",
  qrToken: "tok-1",
  qrUrl: "https://invohub.app/receipts/view?token=tok-1",
  navSubmitted: false,
  lineItems: [],
  clientName: "Test Client",
  issuedAt: "2026-08-01T10:00:00.000Z",
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-01T10:00:00.000Z",
};

describe("sendReceiptEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends email with receipt details", async () => {
    getReceiptById.mockResolvedValue(sampleReceipt);
    getCompanyByUserId.mockResolvedValue({ name: "Acme Kft." });
    sendEmail.mockResolvedValue({ ok: true });

    const result = await sendReceiptEmail("u1", "r1", "test@example.com");

    expect(result.ok).toBe(true);
    expect(result.to).toEqual(["test@example.com"]);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const emailCall = sendEmail.mock.calls[0][0];
    expect(emailCall.subject).toContain("NYG-2026-001");
    expect(emailCall.subject).toContain("Acme Kft.");
    expect(emailCall.html).toContain("NYG-2026-001");
    expect(emailCall.html).toContain("Test Client");
  });

  it("returns error when receipt not found", async () => {
    getReceiptById.mockResolvedValue(null);

    const result = await sendReceiptEmail("u1", "r-missing", "test@example.com");

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns error when no recipients", async () => {
    getReceiptById.mockResolvedValue(sampleReceipt);

    const result = await sendReceiptEmail("u1", "r1", []);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("No recipient");
  });

  it("returns error when email send fails", async () => {
    getReceiptById.mockResolvedValue(sampleReceipt);
    getCompanyByUserId.mockResolvedValue({ name: "Acme" });
    sendEmail.mockResolvedValue({ ok: false, error: "SMTP error" });

    const result = await sendReceiptEmail("u1", "r1", "test@example.com");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("SMTP error");
  });

  it("uses InvoHub as fallback company name", async () => {
    getReceiptById.mockResolvedValue(sampleReceipt);
    getCompanyByUserId.mockResolvedValue(null);
    sendEmail.mockResolvedValue({ ok: true });

    const result = await sendReceiptEmail("u1", "r1", "test@example.com");

    expect(result.ok).toBe(true);
    const emailCall = sendEmail.mock.calls[0][0];
    expect(emailCall.subject).toContain("InvoHub");
  });
});
