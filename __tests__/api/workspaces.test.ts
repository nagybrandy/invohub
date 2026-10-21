/** @jest-environment node */
const mockRequireActor = jest.fn();
const mockRequireSession = jest.fn();
const mockService = {
  listAccounts: jest.fn(),
  createWorkspace: jest.fn(),
  createInvite: jest.fn(),
  listPendingInvites: jest.fn(),
  acceptInvite: jest.fn(),
  leaveAccount: jest.fn(),
};
const mockSendEmail = jest.fn();

jest.mock("@/lib/api/session", () => ({
  requireActor: (...a: unknown[]) => mockRequireActor(...a),
  requireSession: (...a: unknown[]) => mockRequireSession(...a),
  unauthorizedResponse: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
  jsonResponse: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
}));
jest.mock("@/lib/workspaces/service", () => {
  class WorkspaceLimitError extends Error {}
  const lazy = (name: keyof typeof mockService) => (...args: unknown[]) => (mockService[name] as (...a: unknown[]) => unknown)(...args);
  return {
    WorkspaceLimitError,
    listAccounts: lazy("listAccounts"),
    createWorkspace: lazy("createWorkspace"),
    createInvite: lazy("createInvite"),
    listPendingInvites: lazy("listPendingInvites"),
    acceptInvite: lazy("acceptInvite"),
    leaveAccount: lazy("leaveAccount"),
  };
});
jest.mock("@/lib/email/send", () => ({ sendEmail: (...a: unknown[]) => mockSendEmail(...a) }));
jest.mock("@/db", () => ({
  db: { select: () => ({ from: () => ({ where: async () => [{ name: "Ügyfél Kft." }] }) }) },
}));

import { GET as listGet, POST as createPost } from "@/app/api/workspaces+api";
import { POST as invitePost } from "@/app/api/workspaces/invites+api";
import { POST as acceptPost } from "@/app/api/workspaces/invites/accept+api";
import { POST as leavePost } from "@/app/api/workspaces/leave+api";
import { WorkspaceLimitError } from "@/lib/workspaces/service";

const PERSON = { user: { id: "p1", name: "Kovács Anna", email: "anna@x.hu" } };
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://app.invohub.hu${path}`, { method: "POST", body: JSON.stringify(body), headers });

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireActor.mockResolvedValue(PERSON);
  mockRequireSession.mockResolvedValue({ ...PERSON, user: { ...PERSON.user, id: "ws-aaaaaa" } });
  mockSendEmail.mockResolvedValue({ ok: true });
});

describe("GET /api/workspaces", () => {
  it("lists the person's accounts and honours only a selection they really have", async () => {
    mockService.listAccounts.mockResolvedValue([
      { id: "p1", name: "Anna", kind: "person", role: "owner", isOwn: true },
      { id: "ws-aaaaaa", name: "Ügyfél Kft.", kind: "workspace", role: "viewer", isOwn: false },
    ]);
    const ok = await listGet(new Request("https://x.hu/api/workspaces", { headers: { "x-invohub-account": "ws-aaaaaa" } }));
    expect((await ok.json()).activeId).toBe("ws-aaaaaa");
    const forged = await listGet(new Request("https://x.hu/api/workspaces", { headers: { "x-invohub-account": "not-mine-999" } }));
    expect((await forged.json()).activeId).toBe("p1");
  });
  it("401s without a session", async () => {
    mockRequireActor.mockResolvedValue(null);
    expect((await listGet(new Request("https://x.hu/api/workspaces"))).status).toBe(401);
  });
});

describe("POST /api/workspaces", () => {
  it("creates a workspace; validates the name; reports the limit", async () => {
    mockService.createWorkspace.mockResolvedValue({ id: "ws-new-111", name: "Új Kft." });
    const ok = await createPost(post("/api/workspaces", { name: "  Új Kft. " }));
    expect(ok.status).toBe(201);
    expect(mockService.createWorkspace).toHaveBeenCalledWith("p1", "Új Kft.");
    expect((await createPost(post("/api/workspaces", { name: "x" }))).status).toBe(400);
    expect((await createPost(post("/api/workspaces", {}))).status).toBe(400);
    mockService.createWorkspace.mockRejectedValue(new WorkspaceLimitError());
    const limited = await createPost(post("/api/workspaces", { name: "Még egy" }));
    expect(limited.status).toBe(409);
    expect((await limited.json()).code).toBe("workspaceLimit");
  });
});

describe("POST /api/workspaces/invites", () => {
  beforeEach(() => {
    mockService.createInvite.mockResolvedValue({ invite: { id: "i1", email: "konyvelo@pelda.hu", role: "accountant", expiresAt: "", createdAt: "" }, token: "TOKEN123" });
  });

  it("invites into the CURRENT account, e-mails a link on the request's own origin and returns it to the admin", async () => {
    const res = await invitePost(post("/api/workspaces/invites", { email: "Konyvelo@Pelda.hu", role: "accountant" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.inviteUrl).toBe("https://app.invohub.hu/invite?token=TOKEN123");
    expect(body.emailSent).toBe(true);
    expect(mockService.createInvite).toHaveBeenCalledWith(expect.objectContaining({ accountId: "ws-aaaaaa", role: "accountant", invitedBy: "p1" }));
    expect(mockSendEmail.mock.calls[0][0]).toMatchObject({ to: "konyvelo@pelda.hu" });
    expect(String(mockSendEmail.mock.calls[0][0].html)).toContain("TOKEN123");
  });

  it("still succeeds (with the link) when the e-mail cannot be sent", async () => {
    mockSendEmail.mockResolvedValue({ ok: false, error: "SMTP" });
    const body = await (await invitePost(post("/api/workspaces/invites", { email: "a@b.hu", role: "viewer" }))).json();
    expect(body.emailSent).toBe(false);
    expect(body.inviteUrl).toContain("TOKEN123");
  });

  it("rejects bad e-mails, the owner role, and inviting yourself", async () => {
    expect((await invitePost(post("/api/workspaces/invites", { email: "nope", role: "viewer" }))).status).toBe(400);
    expect((await invitePost(post("/api/workspaces/invites", { email: "a@b.hu", role: "owner" }))).status).toBe(400);
    const self = await invitePost(post("/api/workspaces/invites", { email: "ANNA@x.hu", role: "viewer" }));
    expect(self.status).toBe(400);
    expect((await self.json()).code).toBe("selfInvite");
    expect(mockService.createInvite).not.toHaveBeenCalled();
  });

  it("401s when the role does not allow managing access (requireSession said no)", async () => {
    mockRequireSession.mockResolvedValue(null);
    expect((await invitePost(post("/api/workspaces/invites", { email: "a@b.hu", role: "viewer" }))).status).toBe(401);
  });
});

describe("POST /api/workspaces/invites/accept", () => {
  it("maps the verdicts to statuses and never accepts without a signed-in person", async () => {
    mockService.acceptInvite.mockResolvedValue({ ok: true, accountId: "ws-aaaaaa", accountName: "Ügyfél Kft.", role: "accountant" });
    const ok = await acceptPost(post("/api/workspaces/invites/accept", { token: "TOKEN123" }));
    expect(ok.status).toBe(200);
    expect(mockService.acceptInvite).toHaveBeenCalledWith("TOKEN123", { id: "p1", email: "anna@x.hu" });

    for (const [reason, status] of [["notFound", 404], ["wrongEmail", 403], ["expired", 410], ["revoked", 410], ["alreadyAccepted", 410]] as const) {
      mockService.acceptInvite.mockResolvedValue({ ok: false, reason });
      const res = await acceptPost(post("/api/workspaces/invites/accept", { token: "T" }));
      expect([res.status, (await res.json()).code]).toEqual([status, reason]);
    }
    expect((await acceptPost(post("/api/workspaces/invites/accept", {}))).status).toBe(400);
    mockRequireActor.mockResolvedValue(null);
    expect((await acceptPost(post("/api/workspaces/invites/accept", { token: "T" }))).status).toBe(401);
  });
});

describe("POST /api/workspaces/leave", () => {
  it("lets a member leave, 404s when there was nothing to leave", async () => {
    mockService.leaveAccount.mockResolvedValue(true);
    expect((await leavePost(post("/api/workspaces/leave", { accountId: "ws-aaaaaa" }))).status).toBe(200);
    expect(mockService.leaveAccount).toHaveBeenCalledWith("p1", "ws-aaaaaa");
    mockService.leaveAccount.mockResolvedValue(false);
    expect((await leavePost(post("/api/workspaces/leave", { accountId: "ws-aaaaaa" }))).status).toBe(404);
    expect((await leavePost(post("/api/workspaces/leave", {}))).status).toBe(400);
  });
});
