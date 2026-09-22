// app/api/invoices/[id]/preview+api.test.ts
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
}));

jest.mock("@/lib/invoices/build-pdf-context", () => ({
  buildInvoicePdfContext: jest.fn(),
}));

jest.mock("@/lib/invoices/preview-html", () => ({
  generateInvoicePreviewHtml: jest.fn(() => "<html>branded</html>"),
}));

import { GET } from "@/app/api/invoices/[id]/preview+api";
import { requireSession } from "@/lib/api/session";
import { buildInvoicePdfContext } from "@/lib/invoices/build-pdf-context";
import { generateInvoicePreviewHtml } from "@/lib/invoices/preview-html";
import { getInvoiceById } from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockRequireSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGetInvoice = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockBuildContext = buildInvoicePdfContext as jest.MockedFunction<typeof buildInvoicePdfContext>;
const mockGenerateHtml = generateInvoicePreviewHtml as jest.MockedFunction<typeof generateInvoicePreviewHtml>;

describe("GET /api/invoices/[id]/preview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes the user's company and PDF template into generateInvoicePreviewHtml", async () => {
    const invoice = makeInvoice({ id: "inv-1" });
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetInvoice.mockResolvedValue(invoice);
    const company = { name: "Kovács Bt." };
    const template = { titleText: "SZÁMLA", accentColor: "#6495ed" };
    mockBuildContext.mockResolvedValue({ invoice, company, template } as never);

    const response = await GET(new Request("https://app.test/api/invoices/inv-1/preview"), {
      params: Promise.resolve({ id: "inv-1" }),
    });

    expect(mockBuildContext).toHaveBeenCalledWith("user-1", invoice);
    expect(mockGenerateHtml).toHaveBeenCalledWith(invoice, { company, template });
    const body = (await response.json()) as { html: string };
    expect(body.html).toBe("<html>branded</html>");
  });

  it("passes the resolved buyer address through to generateInvoicePreviewHtml", async () => {
    const invoice = makeInvoice({ id: "inv-1" });
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetInvoice.mockResolvedValue(invoice);
    const buyer = { zipCode: "1011", city: "Budapest", address: "Fő utca 1." };
    mockBuildContext.mockResolvedValue({ invoice, buyer } as never);

    await GET(new Request("https://app.test/api/invoices/inv-1/preview"), {
      params: Promise.resolve({ id: "inv-1" }),
    });

    expect(mockGenerateHtml).toHaveBeenCalledWith(invoice, expect.objectContaining({ buyer }));
  });

  it("returns 404 without building a PDF context when the invoice is missing", async () => {
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetInvoice.mockResolvedValue(null);

    const response = await GET(new Request("https://app.test/api/invoices/missing/preview"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
    expect(mockBuildContext).not.toHaveBeenCalled();
  });
});
