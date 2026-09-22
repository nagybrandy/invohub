// __tests__/api/invoices/preview-pdf-api.test.ts
// POST /api/invoices/preview/pdf — the composer's live side preview: the
// unsaved payload rendered by the SAME generateInvoicePdf the customer gets.
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
}));

jest.mock("@/lib/invoices/build-pdf-context", () => ({
  buildInvoicePdfContext: jest.fn(),
}));

jest.mock("@/lib/invoices/generate-pdf", () => ({
  generateInvoicePdf: jest.fn(async () => Buffer.from("%PDF-1.3 fake")),
}));

import { POST } from "@/app/api/invoices/preview/pdf+api";
import { requireSession } from "@/lib/api/session";
import { buildInvoicePdfContext } from "@/lib/invoices/build-pdf-context";
import { generateInvoicePdf } from "@/lib/invoices/generate-pdf";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockRequireSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockBuildContext = buildInvoicePdfContext as jest.MockedFunction<typeof buildInvoicePdfContext>;
const mockGenerate = generateInvoicePdf as jest.MockedFunction<typeof generateInvoicePdf>;

function post(body: unknown, raw = false) {
  return new Request("https://app.test/api/invoices/preview/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

describe("POST /api/invoices/preview/pdf", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildContext.mockImplementation(async (_userId, invoice) => ({
      invoice,
      company: { name: "Kovács Bt." },
      template: { titleText: "SZÁMLA" } as never,
    }));
  });

  it("returns 401 without a session and never renders", async () => {
    mockRequireSession.mockResolvedValue(null as never);
    const response = await POST(post({ invoice: makeInvoice() }));
    expect(response.status).toBe(401);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("renders the draft through buildInvoicePdfContext + generateInvoicePdf as an unnumbered draft", async () => {
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const invoice = makeInvoice({ invoiceNumber: "INV-SPOOF", status: "paid", clientId: "c-9", documentType: "advance" });

    const response = await POST(post({ invoice }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const [userId, rendered] = mockBuildContext.mock.calls[0]!;
    expect(userId).toBe("user-1");
    expect(rendered).toMatchObject({ invoiceNumber: "", status: "draft", clientId: "c-9", documentType: "advance" });
    expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({ company: { name: "Kovács Bt." } }));
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });

  it("accepts a payload with no line items yet (header/parties preview)", async () => {
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const response = await POST(post({ invoice: makeInvoice({ lineItems: [] }) }));
    expect(response.status).toBe(200);
  });

  it("returns 400 on malformed JSON", async () => {
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const response = await POST(post("{not json", true));
    expect(response.status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("returns 400 when the invoice payload is missing", async () => {
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    const response = await POST(post({}));
    expect(response.status).toBe(400);
    expect(mockBuildContext).not.toHaveBeenCalled();
  });

  it("returns 500 JSON (not a hung request) when rendering fails", async () => {
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGenerate.mockRejectedValueOnce(new Error("pdfkit exploded"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(post({ invoice: makeInvoice() }));
    spy.mockRestore();
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBeTruthy();
    expect(body.error).not.toContain("pdfkit exploded");
  });
});
