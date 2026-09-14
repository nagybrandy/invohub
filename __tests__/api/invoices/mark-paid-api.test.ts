// __tests__/api/invoices/mark-paid-api.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/invoices/service", () => ({
  markInvoicePaid: jest.fn(),
}));

import { requireSession } from "@/lib/api/session";
import { POST } from "@/app/api/invoices/[id]/mark-paid+api";
import { markInvoicePaid } from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockMarkPaid = markInvoicePaid as jest.MockedFunction<typeof markInvoicePaid>;

function request(body: unknown) {
  return new Request("http://localhost/api/invoices/inv-1/mark-paid", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/invoices/[id]/mark-paid", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await POST(request({}), { params: Promise.resolve({ id: "inv-1" }) });
    expect(response.status).toBe(401);
  });

  it("marks the invoice paid and returns it", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockMarkPaid.mockResolvedValue(makeInvoice({ status: "paid", paymentMethod: "transfer" }));

    const response = await POST(request({ paymentMethod: "transfer" }), {
      params: Promise.resolve({ id: "inv-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invoice.status).toBe("paid");
    expect(mockMarkPaid).toHaveBeenCalledWith("user-1", "inv-1", {
      paymentMethod: "transfer",
      paidAt: undefined,
      paidAmount: undefined,
    });
  });

  it("returns 404 when the invoice doesn't exist", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockMarkPaid.mockResolvedValue(null);

    const response = await POST(request({}), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
  });

  it("rejects an invalid paymentMethod", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const response = await POST(request({ paymentMethod: "bitcoin" }), {
      params: Promise.resolve({ id: "inv-1" }),
    });
    expect(response.status).toBe(400);
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  it("rejects a negative paidAmount", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const response = await POST(request({ paidAmount: -5 }), {
      params: Promise.resolve({ id: "inv-1" }),
    });
    expect(response.status).toBe(400);
  });
});
