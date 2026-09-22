// __tests__/api/invoices/invoice-id-api.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
  upsertInvoice: jest.fn(),
  deleteInvoiceById: jest.fn(),
}));

const mockAutoSubmit = jest.fn();
jest.mock("@/lib/nav/auto-submit", () => ({
  autoSubmitToNavOnFinalize: (...args: unknown[]) => mockAutoSubmit(...args),
}));

import { requireSession } from "@/lib/api/session";
import { GET, PATCH } from "@/app/api/invoices/[id]+api";
import { getInvoiceById, upsertInvoice } from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGet = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;

describe("GET /api/invoices/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/invoices/x"), {
      params: { id: "x" },
    });
    expect(response.status).toBe(401);
  });

  it("returns invoice json", async () => {
    const invoice = makeInvoice({ id: "inv-1" });
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGet.mockResolvedValue(invoice);

    const response = await GET(new Request("http://localhost/api/invoices/inv-1"), {
      params: { id: "inv-1" },
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.invoice.id).toBe("inv-1");
  });

  it("returns 404 when missing", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGet.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/invoices/missing"), {
      params: { id: "missing" },
    });
    expect(response.status).toBe(404);
  });

  it("handles undefined params safely", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const response = await GET(new Request("http://localhost/api/invoices"), {});
    expect(response.status).toBe(400);
  });

  it("resolves id from request URL when params are missing", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGet.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/invoices/mr682pvd-ketybxz3p"),
      {}
    );
    expect(mockGet).toHaveBeenCalledWith("user-1", "mr682pvd-ketybxz3p");
    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/invoices/[id] — NAV auto-submit on finalization", () => {
  const mockUpsert = upsertInvoice as jest.MockedFunction<typeof upsertInvoice>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockUpsert.mockImplementation(async (_userId, invoice) => ({ ...invoice, invoiceNumber: "INV-2026-005" }) as never);
    mockAutoSubmit.mockResolvedValue(null);
  });

  it("passes the pre-save invoice as `before` so only a draft -> final transition submits", async () => {
    const draft = makeInvoice({ id: "inv-1", status: "draft", invoiceNumber: "" });
    mockGet.mockResolvedValue(draft);

    const response = await PATCH(
      new Request("http://localhost/api/invoices/inv-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "unpaid" }),
      }),
      { params: { id: "inv-1" } }
    );

    expect(response.status).toBe(200);
    expect(mockAutoSubmit).toHaveBeenCalledWith(
      "user-1",
      draft,
      expect.objectContaining({ status: "unpaid", invoiceNumber: "INV-2026-005" })
    );
  });

  it("returns the NAV result next to the invoice", async () => {
    mockGet.mockResolvedValue(makeInvoice({ id: "inv-1", status: "draft", invoiceNumber: "" }));
    mockAutoSubmit.mockResolvedValue({ outcome: "failed", submission: null, error: "boom" });

    const response = await PATCH(
      new Request("http://localhost/api/invoices/inv-1", { method: "PATCH", body: JSON.stringify({ status: "unpaid" }) }),
      { params: { id: "inv-1" } }
    );
    expect((await response.json()).nav).toEqual({ outcome: "failed", submission: null, error: "boom" });
  });
});
