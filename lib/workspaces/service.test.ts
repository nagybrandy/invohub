/** @jest-environment node */
// The database is replaced by a scripted mockChain: every query builder call
// returns the same chainable thing, and awaiting it yields the next queued
// result (selects, inserts, updates and deletes each have their own queue).
type Queue = unknown[][];
const mockQ: { select: Queue; insert: Queue; update: Queue; delete: Queue } = { select: [], insert: [], update: [], delete: [] };
const mockCalls: { kind: string; method: string; args: unknown[] }[] = [];

function mockChain(kind: keyof typeof mockQ): unknown {
  const target: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(target, {
    get(_t, prop: string) {
      if (prop === "then") {
        const rows = mockQ[kind].shift() ?? [];
        return (resolve: (v: unknown) => void) => resolve(rows);
      }
      return (...args: unknown[]) => {
        mockCalls.push({ kind, method: prop, args });
        return proxy;
      };
    },
  });
  return proxy;
}

jest.mock("@/db", () => ({
  db: {
    select: () => mockChain("select"),
    insert: () => mockChain("insert"),
    update: () => mockChain("update"),
    delete: () => mockChain("delete"),
  },
}));
jest.mock("@/lib/email/templates/service", () => ({ seedDefaultTemplates: jest.fn(async () => undefined) }));
jest.mock("@/lib/id", () => {
  let n = 0;
  return { createId: () => `id-${++n}`, createSecureToken: () => `tok-${++n}-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` };
});

import {
  LastOwnerError,
  WorkspaceLimitError,
  acceptInvite,
  changeMemberRole,
  createInvite,
  createWorkspace,
  getAccountRole,
  leaveAccount,
  listAccounts,
  removeMember,
  revokeInvite,
} from "@/lib/workspaces/service";
import { hashInviteToken } from "@/lib/workspaces/invites";

beforeEach(() => {
  mockQ.select = [];
  mockQ.insert = [];
  mockQ.update = [];
  mockQ.delete = [];
  mockCalls.length = 0;
});
const inserted = (): unknown[] => mockCalls.filter((c) => c.kind === "insert" && c.method === "values").map((c) => c.args[0]);
const NOW = new Date("2026-10-21T10:00:00Z");

describe("getAccountRole", () => {
  it("is the owner of their own account without any access row", async () => {
    mockQ.select = [[{ id: "p1", name: "Anna", kind: "person", closedAt: null }]];
    expect(await getAccountRole("p1", "p1")).toEqual({ role: "owner", name: "Anna", kind: "person" });
  });
  it("uses the access row for someone else's account", async () => {
    mockQ.select = [[{ id: "ws1", name: "Ügyfél Kft.", kind: "workspace", closedAt: null }], [{ role: "accountant" }]];
    expect(await getAccountRole("p1", "ws1")).toEqual({ role: "accountant", name: "Ügyfél Kft.", kind: "workspace" });
  });
  it("is null without access, for an unknown account, for a closed account and for a corrupted role", async () => {
    mockQ.select = [[{ id: "ws1", name: "X", kind: "workspace", closedAt: null }], []];
    expect(await getAccountRole("p1", "ws1")).toBeNull();
    mockQ.select = [[]];
    expect(await getAccountRole("p1", "nope")).toBeNull();
    mockQ.select = [[{ id: "ws1", name: "X", kind: "workspace", closedAt: new Date() }]];
    expect(await getAccountRole("p1", "ws1")).toBeNull();
    mockQ.select = [[{ id: "ws1", name: "X", kind: "workspace", closedAt: null }], [{ role: "superuser" }]];
    expect(await getAccountRole("p1", "ws1")).toBeNull();
  });
});

describe("listAccounts", () => {
  it("puts the person's own account first, then the others by name, preferring the company name", async () => {
    mockQ.select = [
      [
        { id: "ws2", name: "z", kind: "workspace", role: "viewer", closedAt: null },
        { id: "ws1", name: "a", kind: "workspace", role: "owner", closedAt: null },
        { id: "ws3", name: "closed", kind: "workspace", role: "admin", closedAt: new Date() },
      ],
      [{ userId: "ws1", name: "Béta Kft." }, { userId: "ws2", name: "Alfa Bt." }],
    ];
    const out = await listAccounts({ id: "p1", name: "Anna" });
    expect(out.map((a) => [a.id, a.name, a.role, a.isOwn])).toEqual([
      ["p1", "Anna", "owner", true],
      ["ws2", "Alfa Bt.", "viewer", false],
      ["ws1", "Béta Kft.", "owner", false],
    ]);
  });
});

describe("createWorkspace", () => {
  it("creates a non-login user, an owner access row and a company, and refuses beyond the limit", async () => {
    mockQ.select = [[]]; // owns no workspaces yet
    const ws = await createWorkspace("p1", "  Új Kft.  ");
    expect(ws.name).toBe("Új Kft.");
    const rows = inserted() as Record<string, unknown>[];
    expect(rows[0]).toMatchObject({ name: "Új Kft.", kind: "workspace", emailVerified: true, role: "entrepreneur" });
    expect(String(rows[0].email)).toMatch(/@workspace\.invohub\.invalid$/);
    expect(rows[1]).toMatchObject({ accountUserId: ws.id, granteeUserId: "p1", role: "owner" });
    expect(rows[2]).toMatchObject({ userId: ws.id, name: "Új Kft." });

    mockQ.select = [Array.from({ length: 10 }, (_, i) => ({ id: `a${i}` }))];
    await expect(createWorkspace("p1", "Még egy")).rejects.toBeInstanceOf(WorkspaceLimitError);
    await expect(createWorkspace("p1", "   ")).rejects.toThrow();
  });
});

describe("members", () => {
  it("never removes or re-roles the owner", async () => {
    mockQ.select = [[{ id: "a1", role: "owner" }]];
    await expect(removeMember("ws1", "a1")).rejects.toBeInstanceOf(LastOwnerError);
    mockQ.select = [[{ id: "a1", role: "owner" }]];
    await expect(changeMemberRole("ws1", "a1", "viewer")).rejects.toBeInstanceOf(LastOwnerError);
    expect(mockCalls.some((c) => c.kind === "delete" || c.kind === "update")).toBe(false);
  });
  it("removes and re-roles other members, and reports a missing one", async () => {
    mockQ.select = [[{ id: "a2", role: "viewer" }]];
    expect(await removeMember("ws1", "a2")).toBe(true);
    expect(mockCalls.some((c) => c.kind === "delete")).toBe(true);
    mockQ.select = [[{ id: "a2", role: "viewer" }]];
    expect(await changeMemberRole("ws1", "a2", "accountant")).toBe(true);
    expect(mockCalls.find((c) => c.kind === "update" && c.method === "set")?.args[0]).toEqual({ role: "accountant" });
    mockQ.select = [[]];
    expect(await removeMember("ws1", "ghost")).toBe(false);
  });
  it("lets a member leave, but not an owner", async () => {
    mockQ.delete = [[{ id: "a2" }]];
    expect(await leaveAccount("p2", "ws1")).toBe(true);
    mockQ.delete = [[]];
    expect(await leaveAccount("p1", "ws1")).toBe(false);
  });
});

describe("invites", () => {
  it("stores only the token's hash, replaces an older live invite for the same e-mail, and lowercases the address", async () => {
    const { invite, token } = await createInvite({ accountId: "ws1", email: "Konyvelo@Pelda.HU", role: "accountant", invitedBy: "p1", now: NOW });
    expect(invite.email).toBe("konyvelo@pelda.hu");
    const row = inserted().at(-1) as Record<string, unknown>;
    expect(row.tokenHash).toBe(hashInviteToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(mockCalls.some((c) => c.kind === "update" && c.method === "set")).toBe(true); // older invite revoked
  });
  it("revokes a pending invite", async () => {
    mockQ.update = [[{ id: "i1" }]];
    expect(await revokeInvite("ws1", "i1", NOW)).toBe(true);
    mockQ.update = [[]];
    expect(await revokeInvite("ws1", "gone", NOW)).toBe(false);
  });
});

describe("acceptInvite", () => {
  const invite = (over = {}) => ({
    id: "i1", accountUserId: "ws1", email: "konyvelo@pelda.hu", role: "accountant", invitedByUserId: "p1",
    expiresAt: new Date("2026-11-01T00:00:00Z"), acceptedAt: null, revokedAt: null, ...over,
  });
  const person = { id: "p2", email: "Konyvelo@pelda.hu" };

  it("grants the invited role, marks the invite accepted and returns the account", async () => {
    mockQ.select = [[invite()], [], [{ name: "ws-user" }], [{ name: "Ügyfél Kft." }]];
    const res = await acceptInvite("tok", person, NOW);
    expect(res).toEqual({ ok: true, accountId: "ws1", accountName: "Ügyfél Kft.", role: "accountant" });
    expect(inserted().at(-1)).toMatchObject({ accountUserId: "ws1", granteeUserId: "p2", role: "accountant" });
    expect(mockCalls.some((c) => c.kind === "update" && c.method === "set" && "acceptedAt" in (c.args[0] as object))).toBe(true);
  });
  it("refuses an unknown, expired, revoked, already used or wrongly addressed invite — granting nothing", async () => {
    const cases: [unknown, string][] = [
      [null, "notFound"],
      [invite({ expiresAt: new Date("2026-10-01T00:00:00Z") }), "expired"],
      [invite({ revokedAt: new Date() }), "revoked"],
      [invite({ acceptedAt: new Date() }), "alreadyAccepted"],
      [invite({ email: "someone.else@pelda.hu" }), "wrongEmail"],
    ];
    for (const [row, reason] of cases) {
      mockCalls.length = 0;
      mockQ.select = [row ? [row] : []];
      expect(await acceptInvite("tok", person, NOW)).toEqual({ ok: false, reason });
      expect(mockCalls.some((c) => c.kind === "insert" || c.kind === "update")).toBe(false);
    }
  });
  it("never downgrades an existing owner through an invitation", async () => {
    mockQ.select = [[invite({ role: "viewer" })], [{ id: "a9", role: "owner" }], [{ name: "x" }], [{ name: "Ügyfél Kft." }]];
    const res = await acceptInvite("tok", person, NOW);
    expect(res.ok).toBe(true);
    const roleUpdates = mockCalls.filter((c) => c.kind === "update" && c.method === "set" && (c.args[0] as Record<string, unknown>).role !== undefined);
    expect(roleUpdates).toHaveLength(0);
  });
  it("changes the role of someone who already has access", async () => {
    mockQ.select = [[invite({ role: "admin" })], [{ id: "a9", role: "viewer" }], [{ name: "x" }], []];
    expect((await acceptInvite("tok", person, NOW)).ok).toBe(true);
    expect(mockCalls.find((c) => c.kind === "update" && c.method === "set")?.args[0]).toEqual({ role: "admin" });
    expect(inserted().length).toBe(0);
  });
  it("refuses to invite a person into their own account", async () => {
    mockQ.select = [[invite({ accountUserId: "p2" })]];
    expect(await acceptInvite("tok", person, NOW)).toEqual({ ok: false, reason: "invalidRole" });
  });
});
