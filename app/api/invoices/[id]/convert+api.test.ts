// app/api/invoices/[id]/convert+api.test.ts
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
  findExistingConversion: jest.fn(),
  convertProformaToInvoice: jest.fn(),
}));

import { POST } from "@/app/api/invoices/[id]/convert+api";
import { requireSession } from "@/lib/api/session";
import {
  convertProformaToInvoice,
  findExistingConversion,
  getInvoiceById,
} from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockRequireSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGetInvoice = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockFindExisting = findExistingConversion as jest.MockedFunction<typeof findExistingConversion>;
const mockConvert = convertProformaToInvoice as jest.MockedFunction<typeof convertProformaToInvoice>;

function request(id: string) {
  return new Request(`https://app.test/api/invoices/${id}/convert`, { method: "POST" });
}

describe("POST /api/invoices/[id]/convert", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 with no session (AC11)", async () => {
    mockRequireSession.mockResolvedValue(null);
    const response = await POST(request("proforma-1"), { params: Promise.resolve({ id: "proforma-1" }) });
    expect(response.status).toBe(401);
    expect(mockGetInvoice).not.toHaveBeenCalled();
  });

  it("returns 404 when the id does not belong to the user (AC11)", async () => {
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetInvoice.mockResolvedValue(null);
    const response = await POST(request("missing"), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
  });

  it("returns 400 notProforma for a non-proforma document, without calling convertProformaToInvoice (AC12)", async () => {
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetInvoice.mockResolvedValue(makeInvoice({ documentType: "invoice", status: "sent" }));

    const response = await POST(request("inv-1"), { params: Promise.resolve({ id: "inv-1" }) });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("notProforma");
    expect(mockConvert).not.toHaveBeenCalled();
  });

  it("returns 400 cancelled for a cancelled proforma, without calling convertProformaToInvoice (AC12)", async () => {
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetInvoice.mockResolvedValue(
      makeInvoice({ documentType: "proforma", status: "cancelled" })
    );

    const response = await POST(request("proforma-1"), { params: Promise.resolve({ id: "proforma-1" }) });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("cancelled");
    expect(mockConvert).not.toHaveBeenCalled();
  });

  it("returns 201 with the new draft invoice for a valid díjbekérő (AC13)", async () => {
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const proforma = makeInvoice({ id: "proforma-1", documentType: "proforma", status: "proforma" });
    mockGetInvoice.mockResolvedValue(proforma);
    mockFindExisting.mockResolvedValue(null);
    const draft = makeInvoice({
      id: "new-inv-1",
      documentType: "invoice",
      status: "draft",
      invoiceNumber: "",
      convertedFromInvoiceId: "proforma-1",
    });
    mockConvert.mockResolvedValue(draft);

    const response = await POST(request("proforma-1"), { params: Promise.resolve({ id: "proforma-1" }) });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.invoice.documentType).toBe("invoice");
    expect(body.invoice.status).toBe("draft");
    expect(mockConvert).toHaveBeenCalledWith("user-1", proforma);
  });

  it("returns 409 alreadyConverted carrying the existing invoice, and creates nothing (AC14)", async () => {
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const proforma = makeInvoice({ id: "proforma-1", documentType: "proforma", status: "proforma" });
    mockGetInvoice.mockResolvedValue(proforma);
    const existing = makeInvoice({ id: "existing-inv", documentType: "invoice", status: "draft" });
    mockFindExisting.mockResolvedValue(existing);

    const response = await POST(request("proforma-1"), { params: Promise.resolve({ id: "proforma-1" }) });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe("alreadyConverted");
    expect(body.invoice.id).toBe("existing-inv");
    expect(mockConvert).not.toHaveBeenCalled();
  });
});
