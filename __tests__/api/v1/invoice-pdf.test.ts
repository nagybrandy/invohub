// __tests__/api/v1/invoice-pdf.test.ts
jest.mock("@/lib/api/api-key-auth", () => ({
  requireApiKeyForV1: jest.fn(),
  jsonApiResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/api/resolve-id-param", () => ({
  resolveIdParam: jest.fn(async (_req: Request, params: Promise<{ id: string }>) => (await params).id),
}));

jest.mock("@/lib/invoices/service", () => ({
  getInvoiceById: jest.fn(),
}));

jest.mock("@/lib/invoices/build-pdf-context", () => ({
  buildInvoicePdfContext: jest.fn(),
}));

jest.mock("@/lib/invoices/generate-pdf", () => ({
  generateInvoicePdf: jest.fn(),
  invoicePdfFilename: jest.fn((n: string) => `${n || "DRAFT"}.pdf`),
}));

import { GET } from "@/app/api/v1/invoices/[id]/pdf+api";
import { requireApiKeyForV1 } from "@/lib/api/api-key-auth";
import { getInvoiceById } from "@/lib/invoices/service";
import { buildInvoicePdfContext } from "@/lib/invoices/build-pdf-context";
import { generateInvoicePdf } from "@/lib/invoices/generate-pdf";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockAuth = requireApiKeyForV1 as jest.MockedFunction<typeof requireApiKeyForV1>;
const mockGet = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockBuildCtx = buildInvoicePdfContext as jest.MockedFunction<typeof buildInvoicePdfContext>;
const mockGenerate = generateInvoicePdf as jest.MockedFunction<typeof generateInvoicePdf>;

function authOk(userId = "user-1") {
  mockAuth.mockResolvedValue({ ok: true, userId, apiKey: { id: "key-1", userId } as never } as never);
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/v1/invoices/[id]/pdf", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 without a valid key", async () => {
    mockAuth.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Invalid API key." }, { status: 401 }),
    } as never);
    const response = await GET(new Request("http://localhost/api/v1/invoices/inv-1/pdf"), params("inv-1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 for a missing/foreign invoice", async () => {
    authOk();
    mockGet.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/v1/invoices/missing/pdf"), params("missing"));
    expect(response.status).toBe(404);
  });

  it("streams the PDF with application/pdf content type", async () => {
    authOk("user-1");
    const invoice = makeInvoice({ id: "inv-1", invoiceNumber: "INV-2026-001" });
    mockGet.mockResolvedValue(invoice);
    mockBuildCtx.mockResolvedValue({ invoice } as never);
    mockGenerate.mockResolvedValue(Buffer.from("pdf-bytes"));

    const response = await GET(new Request("http://localhost/api/v1/invoices/inv-1/pdf"), params("inv-1"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(mockBuildCtx).toHaveBeenCalledWith("user-1", invoice);
  });
});
