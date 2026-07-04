// app/api/admin/api-docs.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/docs/load-external-api-doc", () => ({
  EXTERNAL_API_DOC_FILENAME: "external-api.md",
  loadExternalApiDoc: jest.fn(() => "# InvoHub External API\n"),
}));

import { requireSession } from "@/lib/api/session";
import { GET } from "@/app/api/admin/api-docs+api";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;

describe("GET /api/admin/api-docs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/admin/api-docs"));
    expect(response.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1", role: "entrepreneur" } });
    const response = await GET(new Request("http://localhost/api/admin/api-docs"));
    expect(response.status).toBe(403);
  });

  it("returns json doc for admin", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    const response = await GET(new Request("http://localhost/api/admin/api-docs"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.filename).toBe("external-api.md");
    expect(body.content).toContain("InvoHub External API");
  });

  it("returns markdown attachment when download=1", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    const response = await GET(
      new Request("http://localhost/api/admin/api-docs?download=1")
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/markdown");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    const text = await response.text();
    expect(text).toContain("InvoHub External API");
  });
});
