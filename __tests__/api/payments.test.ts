// __tests__/api/payments.test.ts
// POST /api/payments must never hand out a fake payment link: Revolut and
// Barion adapters are stubs (lib/payments/revolut.ts, lib/payments/barion.ts
// never call a real provider API), so requests for those providers must be
// refused with 501 + a stable code instead of a placeholder URL.
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
}));

jest.mock("@/db", () => ({
  db: {
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn().mockResolvedValue(undefined),
      })),
    })),
  },
}));

jest.mock("@/db/schema", () => ({
  invoice: { id: "invoice.id", userId: "invoice.userId" },
}));

import { requireSession } from "@/lib/api/session";
import { POST } from "@/app/api/payments+api";
import { getInvoiceById } from "@/lib/invoices/service";
import { PAYMENT_PROVIDER_UNAVAILABLE_CODE } from "@/lib/payments/availability";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGetInvoice = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;

function request(body: unknown) {
  return new Request("http://localhost/api/payments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/payments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await POST(request({ invoiceId: "inv-1" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 without invoiceId", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(400);
  });

  it("rejects the default (revolut) provider with 501 + stable code, never a fake URL", async () => {
    const response = await POST(request({ invoiceId: "inv-1" }));
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.code).toBe(PAYMENT_PROVIDER_UNAVAILABLE_CODE);
    expect(body.code).toBe("paymentProviderUnavailable");
    expect(body.payment).toBeUndefined();
    expect(mockGetInvoice).not.toHaveBeenCalled();
  });

  it("rejects an explicit revolut request with 501", async () => {
    const response = await POST(request({ invoiceId: "inv-1", provider: "revolut" }));
    expect(response.status).toBe(501);
  });

  it("rejects an explicit barion request with 501", async () => {
    const response = await POST(request({ invoiceId: "inv-1", provider: "barion" }));
    expect(response.status).toBe(501);
  });

  it("rejects an unknown provider with 400", async () => {
    const response = await POST(request({ invoiceId: "inv-1", provider: "paypal" }));
    expect(response.status).toBe(400);
  });

  it("allows the manual provider through and persists its (empty) link", async () => {
    mockGetInvoice.mockResolvedValue(makeInvoice({ id: "inv-1" }));

    const response = await POST(request({ invoiceId: "inv-1", provider: "manual" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.payment.provider).toBe("manual");
    expect(body.payment.url).toBe("");
  });

  it("returns 404 when the invoice doesn't exist, for an available provider", async () => {
    mockGetInvoice.mockResolvedValue(null);
    const response = await POST(request({ invoiceId: "missing", provider: "manual" }));
    expect(response.status).toBe(404);
  });
});
