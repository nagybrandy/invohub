// app/api/clients/suggestions+api.test.ts
import { GET } from "@/app/api/clients/suggestions+api";

const mockRequireSession = jest.fn();
const mockList = jest.fn();
jest.mock("@/lib/api/session", () => ({
  requireSession: (...a: unknown[]) => mockRequireSession(...a),
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  jsonResponse: (d: unknown, s = 200) => Response.json(d, { status: s }),
}));
jest.mock("@/lib/clients/suggestions", () => ({
  listPartnerSuggestions: (...a: unknown[]) => mockList(...a),
}));

const req = (qs = "") => new Request(`http://localhost/api/clients/suggestions${qs}`);

beforeEach(() => {
  jest.clearAllMocks();
  mockList.mockResolvedValue([]);
});

it("401s without a session and never queries", async () => {
  mockRequireSession.mockResolvedValue(null);
  expect((await GET(req())).status).toBe(401);
  expect(mockList).not.toHaveBeenCalled();
});

it("is scoped to the active billing account's id, not the signed-in person", async () => {
  // requireSession swaps user.id to the selected account (scope.actorId = person)
  mockRequireSession.mockResolvedValue({
    user: { id: "account-A", role: "entrepreneur" },
    scope: { accountId: "account-A", actorId: "person-1", role: "owner" },
  });
  const res = await GET(req("?q=acme"));
  expect(res.status).toBe(200);
  expect(mockList).toHaveBeenCalledWith("account-A", "acme");
  expect(mockList).not.toHaveBeenCalledWith("person-1", expect.anything());
});

it("passes an empty query for the focus (top few) case", async () => {
  mockRequireSession.mockResolvedValue({ user: { id: "u1", role: "entrepreneur" } });
  await GET(req());
  expect(mockList).toHaveBeenCalledWith("u1", "");
});

it("returns the suggestions", async () => {
  mockRequireSession.mockResolvedValue({ user: { id: "u1", role: "entrepreneur" } });
  mockList.mockResolvedValue([{ partner: { name: "X" } }]);
  expect(await (await GET(req())).json()).toEqual({ suggestions: [{ partner: { name: "X" } }] });
});
