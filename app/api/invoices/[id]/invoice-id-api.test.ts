// app/api/invoices/[id]/invoice-id-api.test.ts
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

import { requireSession } from "@/lib/api/session";
import { GET } from "@/app/api/invoices/[id]+api";
import { getInvoiceById } from "@/lib/invoices/service";
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
    const response = await GET(new Request("http://localhost/api/invoices/missing"), {});
    expect(response.status).toBe(400);
  });
});
