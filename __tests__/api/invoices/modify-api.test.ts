// app/api/invoices/[id]/modify+api.test.ts
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
  createModificationDraft: jest.fn(),
}));

import { POST } from "@/app/api/invoices/[id]/modify+api";
import { requireSession } from "@/lib/api/session";
import { createModificationDraft, getInvoiceById } from "@/lib/invoices/service";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

const mockRequireSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGetInvoice = getInvoiceById as jest.MockedFunction<typeof getInvoiceById>;
const mockCreateModification = createModificationDraft as jest.MockedFunction<typeof createModificationDraft>;

describe("POST /api/invoices/[id]/modify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 for a proforma and never allocates a number (AC16)", async () => {
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockGetInvoice.mockResolvedValue(
      makeInvoice({ id: "proforma-1", documentType: "proforma", status: "proforma" })
    );

    const response = await POST(
      new Request("https://app.test/api/invoices/proforma-1/modify", { method: "POST" }),
      { params: Promise.resolve({ id: "proforma-1" }) }
    );

    expect(response.status).toBe(400);
    expect(mockCreateModification).not.toHaveBeenCalled();
  });
});
