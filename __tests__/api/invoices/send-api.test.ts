// __tests__/api/invoices/send-api.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/invoices/send-invoice-email", () => ({
  sendInvoiceNotificationEmail: jest.fn(),
}));

import { requireSession } from "@/lib/api/session";
import { POST } from "@/app/api/invoices/[id]/send+api";
import { sendInvoiceNotificationEmail } from "@/lib/invoices/send-invoice-email";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockSend = sendInvoiceNotificationEmail as jest.MockedFunction<
  typeof sendInvoiceNotificationEmail
>;

function request(body: unknown = {}) {
  return new Request("http://localhost/api/invoices/inv-1/send", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/invoices/[id]/send", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await POST(request(), { params: Promise.resolve({ id: "inv-1" }) });
    expect(response.status).toBe(401);
  });

  it("sends the invoice and returns it", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockSend.mockResolvedValue({
      ok: true,
      invoice: makeInvoice({ status: "sent" }),
      to: ["client@example.com"],
      cc: [],
      pdfAttached: true,
    });

    const response = await POST(request(), { params: Promise.resolve({ id: "inv-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invoice.status).toBe("sent");
  });

  it("returns 422 with code companyProfileIncomplete when finalizing on send fails", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockSend.mockResolvedValue({
      ok: false,
      error: "Company profile is incomplete.",
      code: "companyProfileIncomplete",
      missingFields: ["taxNumber", "address"],
    });

    const response = await POST(request(), { params: Promise.resolve({ id: "inv-1" }) });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.code).toBe("companyProfileIncomplete");
    expect(body.missingFields).toEqual(["taxNumber", "address"]);
  });

  it("returns 404 when the invoice is not found", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockSend.mockResolvedValue({ ok: false, error: "Invoice not found." });

    const response = await POST(request(), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
  });

  it("returns 404 with code invoiceNotFound", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockSend.mockResolvedValue({ ok: false, error: "Invoice not found.", code: "invoiceNotFound" });

    const response = await POST(request(), { params: Promise.resolve({ id: "missing" }) });
    const body = await response.json();
    expect(response.status).toBe(404);
    expect(body.code).toBe("invoiceNotFound");
  });

  it("returns 422 with code noRecipient", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockSend.mockResolvedValue({ ok: false, error: "No invoice email recipient configured.", code: "noRecipient" });

    const response = await POST(request(), { params: Promise.resolve({ id: "inv-1" }) });
    const body = await response.json();
    expect(response.status).toBe(422);
    expect(body.code).toBe("noRecipient");
  });

  it("returns 500 with code templateNotFound", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockSend.mockResolvedValue({ ok: false, error: "Invoice email template not found.", code: "templateNotFound" });

    const response = await POST(request(), { params: Promise.resolve({ id: "inv-1" }) });
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.code).toBe("templateNotFound");
    // The raw English error is still available for logs, but the body must
    // also carry the stable code the UI actually renders.
    expect(body.error).toBe("Invoice email template not found.");
  });

  it("returns 500 with code pdfFailed", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockSend.mockResolvedValue({ ok: false, error: "Failed to generate PDF.", code: "pdfFailed" });

    const response = await POST(request(), { params: Promise.resolve({ id: "inv-1" }) });
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.code).toBe("pdfFailed");
  });

  it("returns 502 with code emailSendFailed", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockSend.mockResolvedValue({
      ok: false,
      error: "535 Authentication failed",
      code: "emailSendFailed",
      to: ["client@example.com"],
    });

    const response = await POST(request(), { params: Promise.resolve({ id: "inv-1" }) });
    const body = await response.json();
    expect(response.status).toBe(502);
    expect(body.code).toBe("emailSendFailed");
  });
});
