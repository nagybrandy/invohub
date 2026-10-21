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
  AdminOnlyError,
  InviteLimitError,
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
  it("only the owner may remove or re-role an administrator, or make someone one", async () => {
    for (const actor of ["admin", "accountant"] as const) {
      mockQ.select = [[{ id: "a3", role: "admin" }]];
      await expect(removeMember("ws1", "a3", actor)).rejects.toBeInstanceOf(AdminOnlyError);
      mockQ.select = [[{ id: "a3", role: "admin" }]];
      await expect(changeMemberRole("ws1", "a3", "viewer", actor)).rejects.toBeInstanceOf(AdminOnlyError);
      mockQ.select = [[{ id: "a4", role: "viewer" }]];
      await expect(changeMemberRole("ws1", "a4", "admin", actor)).rejects.toBeInstanceOf(AdminOnlyError);
    }
    mockQ.select = [[{ id: "a3", role: "admin" }]];
    expect(await removeMember("ws1", "a3", "owner")).toBe(true);
    // an admin may still manage non-admins
    mockQ.select = [[{ id: "a4", role: "viewer" }]];
    expect(await changeMemberRole("ws1", "a4", "accountant", "admin")).toBe(true);
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
  it("caps pending invitations per account, but a re-invite of the same address does not count", async () => {
    const pending = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i${i}`, accountUserId: "ws1", email: `p${i}@x.hu`, role: "viewer", expiresAt: new Date("2027-01-01"), createdAt: NOW }));
    mockQ.select = [pending(20)];
    await expect(createInvite({ accountId: "ws1", email: "new@x.hu", role: "viewer", invitedBy: "p1", now: NOW })).rejects.toBeInstanceOf(InviteLimitError);
    mockQ.select = [pending(20)];
    await expect(createInvite({ accountId: "ws1", email: "p3@x.hu", role: "viewer", invitedBy: "p1", now: NOW })).resolves.toBeDefined();
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
  // getAccountRole(inviter, account): the account's user row, then (inviter is not the account) the inviter's access row
  const inviterIsOwner = [[{ id: "ws1", name: "ws-user", kind: "workspace", closedAt: null }], [{ role: "owner" }]];
  const claimed = [[{ id: "i1" }]];

  it("claims the invite atomically, grants the invited role and returns the account", async () => {
    mockQ.select = [[invite()], ...inviterIsOwner, [], [{ name: "Ügyfél Kft." }]];
    mockQ.update = [...claimed];
    const res = await acceptInvite("tok", person, NOW);
    expect(res).toEqual({ ok: true, accountId: "ws1", accountName: "Ügyfél Kft.", role: "accountant" });
    expect(inserted().at(-1)).toMatchObject({ accountUserId: "ws1", granteeUserId: "p2", role: "accountant" });
    const claim = mockCalls.find((c) => c.kind === "update" && c.method === "set");
    expect(claim && "acceptedAt" in (claim.args[0] as object)).toBe(true);
    // the claim is conditional (accepted_at IS NULL, not revoked, not expired), not a blind update
    expect(mockCalls.some((c) => c.kind === "update" && c.method === "where")).toBe(true);
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

  it("loses a race: if another request claimed it first, nothing is granted", async () => {
    mockQ.select = [[invite()], ...inviterIsOwner];
    mockQ.update = [[]]; // the conditional UPDATE matched no row
    expect(await acceptInvite("tok", person, NOW)).toEqual({ ok: false, reason: "alreadyAccepted" });
    expect(mockCalls.some((c) => c.kind === "insert")).toBe(false);
  });

  it("is worthless once the inviter lost their rights (removed, demoted to accountant, or the account closed)", async () => {
    for (const inviterRows of [
      [[{ id: "ws1", name: "x", kind: "workspace", closedAt: null }], []], // no access row any more
      [[{ id: "ws1", name: "x", kind: "workspace", closedAt: null }], [{ role: "accountant" }]], // demoted
      [[{ id: "ws1", name: "x", kind: "workspace", closedAt: new Date() }]], // account closed
    ]) {
      mockCalls.length = 0;
      mockQ.select = [[invite()], ...inviterRows];
      expect(await acceptInvite("tok", person, NOW)).toEqual({ ok: false, reason: "revoked" });
      expect(mockCalls.some((c) => c.kind === "insert" || c.kind === "update")).toBe(false);
    }
    // an invitation without any inviter on record (deleted user) cannot be redeemed either
    mockQ.select = [[invite({ invitedByUserId: null })]];
    expect(await acceptInvite("tok", person, NOW)).toEqual({ ok: false, reason: "revoked" });
  });

  it("an administrator invite only counts if the inviter is (still) the owner", async () => {
    mockQ.select = [[invite({ role: "admin" })], [{ id: "ws1", name: "x", kind: "workspace", closedAt: null }], [{ role: "admin" }]];
    expect(await acceptInvite("tok", person, NOW)).toEqual({ ok: false, reason: "revoked" });
    expect(mockCalls.some((c) => c.kind === "insert" || c.kind === "update")).toBe(false);
  });

  it("an inviter who is the account's own person is its owner", async () => {
    mockQ.select = [[invite({ accountUserId: "p1", invitedByUserId: "p1" })], [{ id: "p1", name: "Anna", kind: "person", closedAt: null }], [], [{ name: "Anna e.v." }]];
    mockQ.update = [...claimed];
    expect((await acceptInvite("tok", person, NOW)).ok).toBe(true);
  });

  it("never downgrades an existing owner through an invitation", async () => {
    mockQ.select = [[invite({ role: "viewer" })], ...inviterIsOwner, [{ id: "a9", role: "owner" }], [{ name: "Ügyfél Kft." }]];
    mockQ.update = [...claimed];
    expect((await acceptInvite("tok", person, NOW)).ok).toBe(true);
    const roleUpdates = mockCalls.filter((c) => c.kind === "update" && c.method === "set" && (c.args[0] as Record<string, unknown>).role !== undefined);
    expect(roleUpdates).toHaveLength(0);
  });

  it("changes the role of someone who already has access", async () => {
    mockQ.select = [[invite({ role: "admin" })], ...inviterIsOwner, [{ id: "a9", role: "viewer" }], []];
    mockQ.update = [...claimed, []];
    expect((await acceptInvite("tok", person, NOW)).ok).toBe(true);
    const roleUpdate = mockCalls.filter((c) => c.kind === "update" && c.method === "set").find((c) => (c.args[0] as Record<string, unknown>).role !== undefined);
    expect(roleUpdate?.args[0]).toEqual({ role: "admin" });
    expect(inserted().length).toBe(0);
  });

  it("refuses to invite a person into their own account", async () => {
    mockQ.select = [[invite({ accountUserId: "p2" })]];
    expect(await acceptInvite("tok", person, NOW)).toEqual({ ok: false, reason: "invalidRole" });
  });
});
