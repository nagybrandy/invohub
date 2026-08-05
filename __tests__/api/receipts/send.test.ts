// __tests__/api/receipts/send.test.ts
jest.mock("@/lib/api/session", () => ({
  requireSession: jest.fn(),
  unauthorizedResponse: () =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/lib/receipts/send-receipt-email", () => ({
  sendReceiptEmail: jest.fn(),
}));

import { requireSession } from "@/lib/api/session";
import { sendReceiptEmail } from "@/lib/receipts/send-receipt-email";
import { POST } from "@/app/api/receipts/[id]/send+api";

const mockSession = requireSession as jest.MockedFunction<typeof requireSession>;
const mockSend = sendReceiptEmail as jest.MockedFunction<typeof sendReceiptEmail>;

function makeRequest(id: string, body: object) {
  return new Request(`http://localhost/api/receipts/${id}/send`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/receipts/[id]/send", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "user-1" } } as never);
  });

  it("returns 401 without session", async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(makeRequest("r1", { to: "a@b.com" }), {
      params: { id: "r1" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    const res = await POST(
      new Request("http://localhost/api/receipts//send", {
        method: "POST",
        body: JSON.stringify({ to: "a@b.com" }),
      }),
      {}
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when recipient is missing", async () => {
    const res = await POST(makeRequest("r1", {}), {
      params: { id: "r1" },
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Recipient email");
  });

  it("returns 404 when receipt not found", async () => {
    mockSend.mockResolvedValue({
      ok: false,
      error: "Receipt not found.",
    });

    const res = await POST(makeRequest("missing", { to: "a@b.com" }), {
      params: { id: "missing" },
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain("not found");
  });

  it("returns 200 on success", async () => {
    mockSend.mockResolvedValue({
      ok: true,
      to: ["a@b.com"],
    });

    const res = await POST(makeRequest("r1", { to: "a@b.com" }), {
      params: { id: "r1" },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.to).toEqual(["a@b.com"]);
    expect(mockSend).toHaveBeenCalledWith("user-1", "r1", "a@b.com");
  });

  it("returns 500 on send failure without 'not found'", async () => {
    mockSend.mockResolvedValue({
      ok: false,
      error: "SMTP connection failed",
    });

    const res = await POST(makeRequest("r1", { to: "a@b.com" }), {
      params: { id: "r1" },
    });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("SMTP connection failed");
  });

  it("accepts array of recipients", async () => {
    mockSend.mockResolvedValue({ ok: true, to: ["a@b.com", "c@d.com"] });

    const res = await POST(
      makeRequest("r1", { to: ["a@b.com", "c@d.com"] }),
      { params: { id: "r1" } }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith("user-1", "r1", ["a@b.com", "c@d.com"]);
  });
});
