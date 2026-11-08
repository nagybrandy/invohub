/** @jest-environment node */
const mockActor = jest.fn();
const mockRequest = jest.fn();
const mockCancel = jest.fn();
const mockStatus = jest.fn();
let mockFlagOn = false;

jest.mock("@/lib/api/session", () => ({
  requireActor: (...a: unknown[]) => mockActor(...a),
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (d: unknown, s = 200) => Response.json(d, { status: s }),
}));
jest.mock("@/lib/account/deletion-flag", () => ({ isAccountDeletionEnabled: () => mockFlagOn }));
jest.mock("@/lib/account/deletion-request", () => ({
  requestDeletion: (...a: unknown[]) => mockRequest(...a),
  cancelDeletionRequest: (...a: unknown[]) => mockCancel(...a),
  getDeletionStatus: (...a: unknown[]) => mockStatus(...a),
}));

import { DELETE, GET, POST } from "@/app/api/account/deletion+api";

const req = (method: string, body?: unknown) =>
  new Request("https://app.invohub.hu/api/account/deletion", {
    method,
    headers: { "x-invohub-account": "someone-elses-workspace", "content-type": "application/json" },
    body: body && method === "POST" ? JSON.stringify(body) : undefined,
  });

beforeEach(() => {
  mockFlagOn = false;
  [mockActor, mockRequest, mockCancel, mockStatus].forEach((m) => m.mockReset());
  mockActor.mockResolvedValue({ user: { id: "u1" } });
});

describe("/api/account/deletion — flag OFF (default)", () => {
  it.each([
    ["GET", GET],
    ["POST", POST],
    ["DELETE", DELETE],
  ] as const)("%s answers 404 and touches nothing", async (method, handler) => {
    const res = await handler(req(method, { confirm: true }));
    expect(res.status).toBe(404);
    expect(mockActor).not.toHaveBeenCalled();
    expect(mockRequest).not.toHaveBeenCalled();
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockStatus).not.toHaveBeenCalled();
  });
});

describe("/api/account/deletion — flag ON", () => {
  beforeEach(() => {
    mockFlagOn = true;
  });

  it("401 when not signed in", async () => {
    mockActor.mockResolvedValue(null);
    for (const [m, h] of [["GET", GET], ["POST", POST], ["DELETE", DELETE]] as const) {
      expect((await h(req(m, { confirm: true }))).status).toBe(401);
    }
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("GET returns the status of the signed-in person's own account", async () => {
    mockStatus.mockResolvedValue({ status: "none", request: null });
    const res = await GET(req("GET"));
    expect(res.status).toBe(200);
    expect(mockStatus).toHaveBeenCalledWith("u1"); // never the x-invohub-account header
    expect(await res.json()).toMatchObject({ enabled: true, status: "none" });
  });

  it("POST requires explicit confirm", async () => {
    const res = await POST(req("POST", {}));
    expect(res.status).toBe(400);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("POST creates a request for the actor's own account (201), 200 when already requested", async () => {
    mockRequest.mockResolvedValueOnce({ id: "r1", status: "requested" });
    const res = await POST(req("POST", { confirm: true, reason: "moving" }));
    expect(res.status).toBe(201);
    expect(mockRequest).toHaveBeenCalledWith({ userId: "u1", reason: "moving" });
    mockRequest.mockResolvedValueOnce({ id: "r1", status: "requested", alreadyRequested: true });
    expect((await POST(req("POST", { confirm: true }))).status).toBe(200);
  });

  it("DELETE cancels, 404 when nothing is open", async () => {
    mockCancel.mockResolvedValueOnce({ id: "r1", status: "cancelled" });
    expect((await DELETE(req("DELETE"))).status).toBe(200);
    expect(mockCancel).toHaveBeenCalledWith({ userId: "u1" });
    mockCancel.mockResolvedValueOnce(null);
    expect((await DELETE(req("DELETE"))).status).toBe(404);
  });
});
