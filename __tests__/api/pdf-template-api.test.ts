// __tests__/api/pdf-template-api.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/invoices/pdf-template/service", () => ({
  getPdfTemplate: jest.fn(),
  upsertPdfTemplate: jest.fn(),
}));

jest.mock("@/lib/invoices/build-pdf-context", () => ({
  buildSamplePdfContext: jest.fn(),
}));

jest.mock("@/lib/invoices/generate-pdf", () => ({
  generateInvoicePdf: jest.fn(),
}));

import { GET, PATCH, POST } from "@/app/api/pdf-template+api";
import { requireSession } from "@/lib/api/session";
import { buildSamplePdfContext } from "@/lib/invoices/build-pdf-context";
import { generateInvoicePdf } from "@/lib/invoices/generate-pdf";
import { DEFAULT_PDF_TEMPLATE } from "@/lib/invoices/pdf-template/defaults";
import { getPdfTemplate, upsertPdfTemplate } from "@/lib/invoices/pdf-template/service";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockGet = getPdfTemplate as jest.MockedFunction<typeof getPdfTemplate>;
const mockUpsert = upsertPdfTemplate as jest.MockedFunction<typeof upsertPdfTemplate>;
const mockContext = buildSamplePdfContext as jest.MockedFunction<typeof buildSamplePdfContext>;
const mockGenerate = generateInvoicePdf as jest.MockedFunction<typeof generateInvoicePdf>;

function request(method: string, body?: unknown, raw?: string) {
  return new Request("http://localhost/api/pdf-template", {
    method,
    headers: { "Content-Type": "application/json" },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
}

describe("/api/pdf-template", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockUpsert.mockResolvedValue(DEFAULT_PDF_TEMPLATE);
    mockGet.mockResolvedValue(DEFAULT_PDF_TEMPLATE);
    mockContext.mockResolvedValue({ invoice: { id: "sample" } } as never);
    mockGenerate.mockResolvedValue(Buffer.from("%PDF-1.3 sample"));
  });

  it.each([GET, PATCH, POST])("requires a session", async (handler) => {
    mockSession.mockResolvedValue(null);
    const response = await handler(request("GET"));
    expect(response.status).toBe(401);
  });

  it("GET returns the user's template", async () => {
    const response = await GET(request("GET"));
    expect(response.status).toBe(200);
    expect((await response.json()).template.layout).toBe("frame");
  });

  describe("PATCH", () => {
    it("passes the VALIDATED value (normalized) to the service", async () => {
      const response = await PATCH(request("PATCH", { accentColor: "#abc", titleText: "  SZÁMLA ", layout: "band", evil: "x" }));
      expect(response.status).toBe(200);
      expect(mockUpsert).toHaveBeenCalledWith("user-1", { accentColor: "#aabbcc", titleText: "SZÁMLA", layout: "band" });
    });

    it("keeps an omitted layout omitted, so the service keeps the stored one", async () => {
      await PATCH(request("PATCH", { titleText: "X" }));
      expect(mockUpsert.mock.calls[0]![1]).not.toHaveProperty("layout");
    });

    it("accepts layout 'legacy' so a round-tripped legacy row stays legacy", async () => {
      const response = await PATCH(request("PATCH", { layout: "legacy" }));
      expect(response.status).toBe(200);
      expect(mockUpsert).toHaveBeenCalledWith("user-1", { layout: "legacy" });
    });

    it.each([
      [{ layout: "hologram" }, ["layout"]],
      [{ fontStyle: "custom" }, ["fontStyle"]],
      [{ logoMode: "svg" }, ["logoMode"]],
      [{ logoSize: "XL" }, ["logoSize"]],
      [{ logoPosition: "top" }, ["logoPosition"]],
      [{ fontScale: "huge" }, ["fontScale"]],
      [{ accentColor: "red" }, ["accentColor"]],
      [{ showBankDetails: "yes" }, ["showBankDetails"]],
      [{ titleText: "x".repeat(41) }, ["titleText"]],
      [{ notesLabel: "x".repeat(41) }, ["notesLabel"]],
      [{ footerText: "x".repeat(201) }, ["footerText"]],
      [{ layout: "x", accentColor: "y" }, ["layout", "accentColor"]],
    ])("rejects %j with 400 invalidPdfTemplate and the field list", async (body, fields) => {
      const response = await PATCH(request("PATCH", body));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Invalid PDF template.",
        code: "invalidPdfTemplate",
        fields,
      });
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it.each([[null], [[]], ["x"]])("rejects a body that is not an object: %j", async (body) => {
      const response = await PATCH(request("PATCH", body));
      expect(response.status).toBe(400);
      expect((await response.json()).fields).toEqual(["body"]);
    });

    it("rejects a body that is not JSON with the same 400", async () => {
      const response = await PATCH(request("PATCH", undefined, "{not json"));
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("invalidPdfTemplate");
    });
  });

  describe("POST (sample PDF with an unsaved template)", () => {
    it("renders the sample with the validated template merged onto Dóri's defaults", async () => {
      const response = await POST(request("POST", { layout: "clean", accentColor: "#e8590c", fontStyle: "round" }));
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
      const ctx = mockGenerate.mock.calls[0]![0];
      expect(ctx.template).toEqual({ ...DEFAULT_PDF_TEMPLATE, layout: "clean", accentColor: "#e8590c", fontStyle: "round" });
    });

    it("validates too: 400 and no PDF for an invalid template", async () => {
      const response = await POST(request("POST", { layout: "nope", logoSize: "XXL" }));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "invalidPdfTemplate", fields: ["layout", "logoSize"] });
      expect(mockGenerate).not.toHaveBeenCalled();
    });
  });
});
