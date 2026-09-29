// __tests__/api/v1/invoice-mark-paid.test.ts
jest.mock("@/lib/api/api-key-auth", () => ({
  requireApiKeyForV1: jest.fn(),
  jsonApiResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/api/resolve-id-param", () => ({
  resolveIdParam: jest.fn(async (_req: Request, params: Promise<{ id: string }>) => (await params).id),
}));

jest.mock("@/lib/invoices/service", () => ({
  markInvoicePaid: jest.fn(),
}));

import { POST } from "@/app/api/v1/invoices/[id]/mark-paid+api";
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { markInvoicePaid } from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockAuth = requireApiKeyForV1 as jest.MockedFunction<typeof requireApiKeyForV1>;
const mockMarkPaid = markInvoicePaid as jest.MockedFunction<typeof markInvoicePaid>;

function authOk(userId = "user-1") {
  mockAuth.mockResolvedValue({ ok: true, userId, apiKey: { id: "key-1", userId } as never } as never);
}

function req(id: string, body?: unknown) {
  return new Request(`http://localhost/api/v1/invoices/${id}/mark-paid`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/v1/invoices/[id]/mark-paid", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without a valid key", async () => {
    mockAuth.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Invalid API key." }, { status: 401 }),
    } as never);
    const response = await POST(req("inv-1"), params("inv-1"));
    expect(response.status).toBe(401);
  });

  it("rejects an invalid paymentMethod without calling markInvoicePaid", async () => {
    authOk();
    const response = await POST(req("inv-1", { paymentMethod: "bitcoin" }), params("inv-1"));
    expect(response.status).toBe(400);
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing/foreign invoice", async () => {
    authOk("user-1");
    mockMarkPaid.mockResolvedValue(null);
    const response = await POST(req("missing"), params("missing"));
    expect(response.status).toBe(404);
  });

  it("marks the invoice paid and returns it", async () => {
    authOk("user-1");
    mockMarkPaid.mockResolvedValue(makeInvoice({ id: "inv-1", status: "paid", paymentMethod: "transfer" }));

    const response = await POST(req("inv-1", { paymentMethod: "transfer" }), params("inv-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invoice.status).toBe("paid");
    expect(mockMarkPaid).toHaveBeenCalledWith("user-1", "inv-1", {
      paymentMethod: "transfer",
      paidAt: undefined,
      paidAmount: undefined,
    });
  });
});
