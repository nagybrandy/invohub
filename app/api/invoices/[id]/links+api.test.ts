// app/api/invoices/[id]/links+api.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
  jsonResponse: (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
}));

jest.mock("@/lib/api/resolve-id-param", () => ({
  resolveIdParam: jest.fn(async (_req: Request, params: Promise<{ id: string }>) => (await params).id),
}));

jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
  findInvoicesReferencing: jest.fn(),
}));

import { GET } from "@/app/api/invoices/[id]/links+api";
import { requireSession } from "@/lib/api/session";
import { findInvoicesReferencing, getInvoiceById } from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockRequireSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGetInvoice = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockFindReferencing = findInvoicesReferencing as jest.MockedFunction<typeof findInvoicesReferencing>;

describe("GET /api/invoices/[id]/links", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns convertedFromInvoice and convertedToInvoices alongside the existing keys (AC15)", async () => {
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const invoice = makeInvoice({
      id: "inv-1",
      documentType: "invoice",
      convertedFromInvoiceId: "proforma-1",
    });
    const proforma = makeInvoice({ id: "proforma-1", documentType: "proforma" });
    const convertedTo = makeInvoice({ id: "inv-2", convertedFromInvoiceId: "proforma-other" });

    mockGetInvoice.mockImplementation(async (_userId: string, id: string) => {
      if (id === "inv-1") return invoice;
      if (id === "proforma-1") return proforma;
      return null;
    });
    mockFindReferencing.mockImplementation(async (_userId: string, field: string) => {
      if (field === "convertedFromInvoiceId") return [convertedTo];
      return [];
    });

    const response = await GET(new Request("https://app.test/api/invoices/inv-1/links"), {
      params: Promise.resolve({ id: "inv-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.convertedFromInvoice.id).toBe("proforma-1");
    expect(body.convertedToInvoices).toHaveLength(1);
    expect(body.convertedToInvoices[0].id).toBe("inv-2");
    // Existing keys are unchanged.
    expect(body).toHaveProperty("originalInvoice");
    expect(body).toHaveProperty("modifiesInvoice");
    expect(body).toHaveProperty("stornoDocuments");
    expect(body).toHaveProperty("correctionDocuments");
  });

  it("returns null convertedFromInvoice when the invoice was not converted from a proforma", async () => {
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const invoice = makeInvoice({ id: "inv-1", documentType: "invoice" });
    mockGetInvoice.mockResolvedValue(invoice);
    mockFindReferencing.mockResolvedValue([]);

    const response = await GET(new Request("https://app.test/api/invoices/inv-1/links"), {
      params: Promise.resolve({ id: "inv-1" }),
    });

    const body = await response.json();
    expect(body.convertedFromInvoice).toBeNull();
    expect(body.convertedToInvoices).toEqual([]);
  });
});
