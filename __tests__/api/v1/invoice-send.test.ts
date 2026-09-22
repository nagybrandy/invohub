// __tests__/api/v1/invoice-send.test.ts
jest.mock("@/lib/api/api-key-auth", () => ({
  requireApiKeyForV1: jest.fn(),
  jsonApiResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/api/resolve-id-param", () => ({
  resolveIdParam: jest.fn(async (_req: Request, params: Promise<{ id: string }>) => (await params).id),
}));

jest.mock("@/lib/invoices/send-invoice-email", () => ({
  sendInvoiceNotificationEmail: jest.fn(),
}));

jest.mock("@/lib/api/idempotency", () => ({
  withIdempotency: jest.fn(async (_request, _userId, _body, handler) => {
    const result = await handler();
    return Response.json(result.body, { status: result.status });
  }),
}));

import { POST } from "@/app/api/v1/invoices/[id]/send+api";
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { sendInvoiceNotificationEmail } from "@/lib/invoices/send-invoice-email";
import { withIdempotency } from "@/lib/api/idempotency";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockAuth = requireApiKeyForV1 as jest.MockedFunction<typeof requireApiKeyForV1>;
const mockSend = sendInvoiceNotificationEmail as jest.MockedFunction<typeof sendInvoiceNotificationEmail>;
const mockWithIdempotency = withIdempotency as jest.MockedFunction<typeof withIdempotency>;

function authOk(userId = "user-1") {
  mockAuth.mockResolvedValue({ ok: true, userId, apiKey: { id: "key-1", userId } as never } as never);
}

function req(id: string, body?: unknown) {
  return new Request(`http://localhost/api/v1/invoices/${id}/send`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/v1/invoices/[id]/send", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without a valid key", async () => {
    mockAuth.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Invalid API key." }, { status: 401 }),
    } as never);
    const response = await POST(req("inv-1"), params("inv-1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 when sendInvoiceNotificationEmail reports the invoice missing", async () => {
    authOk();
    mockSend.mockResolvedValue({ ok: false, error: "Invoice not found." });
    const response = await POST(req("missing"), params("missing"));
    expect(response.status).toBe(404);
  });

  it("returns 500 with the error for a non-not-found failure (e.g. no recipient)", async () => {
    authOk();
    mockSend.mockResolvedValue({ ok: false, error: "No invoice email recipient configured." });
    const response = await POST(req("inv-1"), params("inv-1"));
    expect(response.status).toBe(500);
  });

  it("returns 422 with code noRecipient when the failure carries that code", async () => {
    authOk();
    mockSend.mockResolvedValue({ ok: false, error: "No invoice email recipient configured.", code: "noRecipient" });
    const response = await POST(req("inv-1"), params("inv-1"));
    const body = await response.json();
    expect(response.status).toBe(422);
    expect(body.code).toBe("noRecipient");
  });

  it("returns 502 with code emailSendFailed, never the raw SMTP error alone as the only signal", async () => {
    authOk();
    mockSend.mockResolvedValue({ ok: false, error: "535 Authentication failed", code: "emailSendFailed" });
    const response = await POST(req("inv-1"), params("inv-1"));
    const body = await response.json();
    expect(response.status).toBe(502);
    expect(body.code).toBe("emailSendFailed");
  });

  it("sends with to/cc overrides and returns the sent invoice", async () => {
    authOk("user-1");
    const invoice = makeInvoice({ id: "inv-1", status: "sent" });
    mockSend.mockResolvedValue({
      ok: true,
      invoice,
      to: ["billing@acme.hu"],
      cc: ["cc@acme.hu"],
      pdfAttached: true,
    });

    const response = await POST(
      req("inv-1", { to: "billing@acme.hu", cc: "cc@acme.hu" }),
      params("inv-1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invoice.id).toBe("inv-1");
    expect(mockSend).toHaveBeenCalledWith("user-1", "inv-1", expect.objectContaining({ to: "billing@acme.hu", cc: "cc@acme.hu" }));
  });

  it("routes through withIdempotency with the parsed body", async () => {
    authOk("user-1");
    mockSend.mockResolvedValue({ ok: true, invoice: makeInvoice({ id: "inv-1" }), to: [], cc: [] });

    await POST(req("inv-1", { to: "a@b.hu" }), params("inv-1"));

    expect(mockWithIdempotency).toHaveBeenCalledTimes(1);
    const [, userId, requestBody] = mockWithIdempotency.mock.calls[0];
    expect(userId).toBe("user-1");
    expect(requestBody).toMatchObject({ to: "a@b.hu" });
  });

  it("includes the invoice id in the idempotency request body, so the same key with an identical body never replays across two different invoices", async () => {
    authOk("user-1");
    mockSend.mockResolvedValue({ ok: true, invoice: makeInvoice({ id: "inv-1" }), to: [], cc: [] });

    await POST(req("inv-1", {}), params("inv-1"));
    await POST(req("inv-2", {}), params("inv-2"));

    expect(mockWithIdempotency).toHaveBeenCalledTimes(2);
    const [, , firstBody] = mockWithIdempotency.mock.calls[0];
    const [, , secondBody] = mockWithIdempotency.mock.calls[1];
    expect(firstBody).not.toEqual(secondBody);
  });
});
