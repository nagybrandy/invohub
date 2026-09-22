// __tests__/api/invoices/tax-audit-export-api.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/invoices/tax-audit-export/generate", () => ({
  generateTaxAuditExport: jest.fn(),
  TAX_AUDIT_MAX_INVOICES: 5000,
}));

import { requireSession } from "@/lib/api/session";
import { GET } from "@/app/api/invoices/tax-audit-export+api";
import { generateTaxAuditExport } from "@/lib/invoices/tax-audit-export/generate";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGenerate = generateTaxAuditExport as jest.MockedFunction<typeof generateTaxAuditExport>;

function req(query: string) {
  return new Request(`http://localhost/api/invoices/tax-audit-export?${query}`, { method: "GET" });
}

describe("GET /api/invoices/tax-audit-export", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
  });

  it("returns 401 without a session and never touches invoice data", async () => {
    mockSession.mockResolvedValue(null);
    const response = await GET(req("from=2026-01-01&to=2026-01-31"));
    expect(response.status).toBe(401);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("returns 400 with a code for an invalid selection", async () => {
    const response = await GET(req("from=2026-02-01&to=2026-01-01"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalidRange", code: "invalidRange" });
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("returns 400 when no selection is given (no silent default range)", async () => {
    const response = await GET(req(""));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("selectionRequired");
  });

  it("streams the XML as a download, scoped to the session user", async () => {
    mockGenerate.mockResolvedValue({
      ok: true,
      xml: "<szamlak/>",
      invoiceCount: 3,
      filename: "adohatosagi-ellenorzesi-adatszolgaltatas_2026-01-01_2026-01-31.xml",
    });

    const response = await GET(req("from=2026-01-01&to=2026-01-31"));

    expect(mockGenerate).toHaveBeenCalledWith("user-1", {
      kind: "date",
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="adohatosagi-ellenorzesi-adatszolgaltatas_2026-01-01_2026-01-31.xml"'
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("<szamlak/>");
  });

  it("accepts a number range", async () => {
    mockGenerate.mockResolvedValue({ ok: true, xml: "<szamlak/>", invoiceCount: 1, filename: "x.xml" });
    await GET(req("fromNumber=INV-2026-00001&toNumber=INV-2026-00004"));
    expect(mockGenerate).toHaveBeenCalledWith("user-1", {
      kind: "number",
      fromNumber: "INV-2026-00001",
      toNumber: "INV-2026-00004",
    });
  });

  it("returns 404 noInvoices when nothing was issued in the range", async () => {
    mockGenerate.mockResolvedValue({ ok: false, reason: "empty" });
    const response = await GET(req("from=2026-01-01&to=2026-01-31"));
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("noInvoices");
  });

  it("returns 422 with the invoice-level problems instead of an invalid file", async () => {
    mockGenerate.mockResolvedValue({
      ok: false,
      reason: "problems",
      problems: [{ invoiceNumber: "INV-2026-00001", field: "buyerZipCode" }],
    });
    const response = await GET(req("from=2026-01-01&to=2026-01-31"));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "incompleteInvoiceData",
      code: "incompleteInvoiceData",
      problems: [{ invoiceNumber: "INV-2026-00001", field: "buyerZipCode" }],
    });
  });

  it("returns 422 tooManyInvoices with the limit", async () => {
    mockGenerate.mockResolvedValue({ ok: false, reason: "tooMany", limit: 5000 });
    const response = await GET(req("from=2020-01-01&to=2026-12-31"));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "tooManyInvoices",
      code: "tooManyInvoices",
      limit: 5000,
    });
  });

  it("returns 500 without leaking internals when generation throws", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockGenerate.mockRejectedValue(new Error("db down: secret connection string"));
    const response = await GET(req("from=2026-01-01&to=2026-01-31"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
    spy.mockRestore();
  });
});
