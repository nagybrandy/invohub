// __tests__/api/invoices/invoices-api.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/invoices/service", () => ({
  listInvoices: jest.fn(),
  getInvoiceStats: jest.fn(),
  upsertInvoice: jest.fn(),
}));

import { requireSession } from "@/lib/api/session";
import { POST } from "@/app/api/invoices+api";
import { upsertInvoice } from "@/lib/invoices/service";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockUpsert = upsertInvoice as jest.MockedFunction<typeof upsertInvoice>;

describe("POST /api/invoices", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockUpsert.mockImplementation(async (_userId, invoice) => invoice as never);
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({ clientName: "Acme" }),
      })
    );
    expect(response.status).toBe(401);
  });

  it("passes exchangeRate through for a non-HUF invoice (AC10)", async () => {
    const response = await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientName: "Acme Kft.",
          currency: "EUR",
          exchangeRate: 390.5,
          lineItems: [],
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [, savedInvoice] = mockUpsert.mock.calls[0];
    expect(savedInvoice.exchangeRate).toBe(390.5);
  });

  it("drops exchangeRate for a HUF invoice even when the body carries one (AC10)", async () => {
    await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientName: "Acme Kft.",
          currency: "HUF",
          exchangeRate: 390.5,
          lineItems: [],
        }),
      })
    );

    const [, savedInvoice] = mockUpsert.mock.calls[0];
    expect(savedInvoice.exchangeRate).toBeUndefined();
  });

  it("drops a non-positive or non-numeric exchangeRate even for a non-HUF invoice", async () => {
    await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientName: "Acme Kft.",
          currency: "EUR",
          exchangeRate: 0,
          lineItems: [],
        }),
      })
    );

    const [, savedInvoice] = mockUpsert.mock.calls[0];
    expect(savedInvoice.exchangeRate).toBeUndefined();
  });

  it("defaults currency to HUF and omits exchangeRate when the body carries neither", async () => {
    await POST(
      new Request("http://localhost/api/invoices", {
        method: "POST",
        body: JSON.stringify({ clientName: "Acme Kft.", lineItems: [] }),
      })
    );

    const [, savedInvoice] = mockUpsert.mock.calls[0];
    expect(savedInvoice.currency).toBe("HUF");
    expect(savedInvoice.exchangeRate).toBeUndefined();
  });
});
