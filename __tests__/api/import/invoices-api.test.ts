// __tests__/api/import/invoices-api.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));
jest.mock("@/lib/import/import-flag", () => ({ isInvoiceImportEnabled: jest.fn() }));
jest.mock("@/lib/import/parse-invoices", () => ({ parseInvoiceSpreadsheet: jest.fn(() => []) }));
jest.mock("@/lib/invoices/service", () => ({ upsertInvoice: jest.fn() }));

import { requireSession } from "@/lib/api/session";
import { isInvoiceImportEnabled } from "@/lib/import/import-flag";
import { parseInvoiceSpreadsheet } from "@/lib/import/parse-invoices";
import { POST } from "@/app/api/import/invoices+api";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockFlag = isInvoiceImportEnabled as jest.MockedFunction<typeof isInvoiceImportEnabled>;
const mockParse = parseInvoiceSpreadsheet as jest.MockedFunction<typeof parseInvoiceSpreadsheet>;

const post = () =>
  POST(new Request("http://localhost/api/import/invoices", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ base64: "AAAA" }),
  }));

describe("POST /api/import/invoices", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "u1" } } as never);
  });

  it("is 404 while the import flag is off, and never parses the upload", async () => {
    mockFlag.mockReturnValue(false);
    const response = await post();
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "importDisabled" });
    expect(mockParse).not.toHaveBeenCalled();
  });

  it("still asks for a session first", async () => {
    mockFlag.mockReturnValue(false);
    mockSession.mockResolvedValue(null);
    expect((await post()).status).toBe(401);
  });

  it("runs the import when the flag is on", async () => {
    mockFlag.mockReturnValue(true);
    const response = await post();
    expect(response.status).toBe(201);
    expect(mockParse).toHaveBeenCalled();
  });
});
