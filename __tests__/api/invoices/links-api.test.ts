// __tests__/api/invoices/links-api.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
  findInvoicesReferencing: jest.fn(),
}));

import { requireSession } from "@/lib/api/session";
import { GET } from "@/app/api/invoices/[id]/links+api";
import { findInvoicesReferencing, getInvoiceById } from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGet = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockFindReferencing = findInvoicesReferencing as jest.MockedFunction<
  typeof findInvoicesReferencing
>;

function req(id: string) {
  return new Request(`http://localhost/api/invoices/${id}/links`, { method: "GET" });
}

describe("GET /api/invoices/[id]/links", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await GET(req("inv-1"), { params: Promise.resolve({ id: "inv-1" }) });
    expect(response.status).toBe(401);
  });

  it("returns 404 when the invoice is missing", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGet.mockResolvedValue(null);
    const response = await GET(req("missing"), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
  });

  it("resolves forward links (original/modifies) and reverse links (storno/correction documents)", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const invoice = makeInvoice({ id: "inv-1", originalInvoiceId: "inv-0", modifiesInvoiceId: undefined });
    mockGet.mockImplementation(async (_uid, id) => {
      if (id === "inv-1") return invoice;
      if (id === "inv-0") return makeInvoice({ id: "inv-0", invoiceNumber: "INV-2026-000" });
      return null;
    });
    mockFindReferencing.mockImplementation(async (_uid, field) => {
      if (field === "originalInvoiceId") return [makeInvoice({ id: "storno-1", documentType: "storno" })];
      return [];
    });

    const response = await GET(req("inv-1"), { params: Promise.resolve({ id: "inv-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.originalInvoice.id).toBe("inv-0");
    expect(body.modifiesInvoice).toBeNull();
    expect(body.stornoDocuments).toHaveLength(1);
    expect(body.correctionDocuments).toHaveLength(0);
  });

  it("skips forward lookups when there is nothing to look up", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGet.mockResolvedValue(makeInvoice({ id: "inv-1" }));
    mockFindReferencing.mockResolvedValue([]);

    const response = await GET(req("inv-1"), { params: Promise.resolve({ id: "inv-1" }) });
    const body = await response.json();

    expect(body.originalInvoice).toBeNull();
    expect(body.modifiesInvoice).toBeNull();
    // Only the id lookup for the invoice itself — no extra getInvoiceById calls.
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("returns convertedFromInvoice and convertedToInvoices alongside the existing keys (AC15)", async () => {
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const invoice = makeInvoice({
      id: "inv-1",
      documentType: "invoice",
      convertedFromInvoiceId: "proforma-1",
    });
    const proforma = makeInvoice({ id: "proforma-1", documentType: "proforma" });
    const convertedTo = makeInvoice({ id: "inv-2", convertedFromInvoiceId: "proforma-other" });
    mockGet.mockImplementation(async (_uid, id) => {
      if (id === "inv-1") return invoice;
      if (id === "proforma-1") return proforma;
      return null;
    });
    mockFindReferencing.mockImplementation(async (_uid, field) => {
      if (field === "convertedFromInvoiceId") return [convertedTo];
      return [];
    });

    const response = await GET(req("inv-1"), { params: Promise.resolve({ id: "inv-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
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
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const invoice = makeInvoice({ id: "inv-1", documentType: "invoice" });
    mockGet.mockResolvedValue(invoice);
    mockFindReferencing.mockResolvedValue([]);

    const response = await GET(req("inv-1"), { params: Promise.resolve({ id: "inv-1" }) });
    const body = await response.json();

    expect(body.convertedFromInvoice).toBeNull();
    expect(body.convertedToInvoices).toEqual([]);
  });
});
