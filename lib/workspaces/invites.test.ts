/** @jest-environment node */
import {
  INVITE_TTL_DAYS,
  evaluateInvite,
  hashInviteToken,
  inviteExpiry,
  isPlausibleEmail,
  newInviteToken,
  normalizeInviteEmail,
} from "@/lib/workspaces/invites";

const NOW = new Date("2026-10-21T10:00:00Z");
const invite = (over = {}) => ({
  email: "konyvelo@pelda.hu", role: "accountant", expiresAt: new Date("2026-11-01T00:00:00Z"), acceptedAt: null, revokedAt: null, ...over,
});

describe("tokens", () => {
  it("makes a URL-safe random token whose stored form is its SHA-256", () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(a.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.tokenHash).toBe(hashInviteToken(a.token));
    expect(a.tokenHash).not.toContain(a.token);
    expect(hashInviteToken(` ${a.token} `)).toBe(a.tokenHash);
  });
  it("expires after the TTL", () => {
    expect(inviteExpiry(NOW).getTime() - NOW.getTime()).toBe(INVITE_TTL_DAYS * 86400000);
  });
});

describe("emails", () => {
  it("normalises case and spaces, and rejects the obviously broken", () => {
    expect(normalizeInviteEmail("  Konyvelo@Pelda.HU ")).toBe("konyvelo@pelda.hu");
    expect(isPlausibleEmail("a@b.hu")).toBe(true);
    for (const bad of ["", "abc", "a@b", "a b@c.hu", "@b.hu"]) expect(isPlausibleEmail(bad)).toBe(false);
  });
});

describe("evaluateInvite", () => {
  it("accepts a fresh invite for the right e-mail (case-insensitively) and returns its role", () => {
    expect(evaluateInvite(invite(), "Konyvelo@pelda.hu", NOW)).toEqual({ ok: true, role: "accountant" });
  });
  it.each([
    ["notFound", null, "konyvelo@pelda.hu"],
    ["revoked", invite({ revokedAt: new Date() }), "konyvelo@pelda.hu"],
    ["alreadyAccepted", invite({ acceptedAt: new Date() }), "konyvelo@pelda.hu"],
    ["expired", invite({ expiresAt: new Date("2026-10-20T00:00:00Z") }), "konyvelo@pelda.hu"],
    ["wrongEmail", invite(), "valaki.mas@pelda.hu"],
    ["invalidRole", invite({ role: "owner" }), "konyvelo@pelda.hu"],
  ])("refuses: %s", (reason, row, email) => {
    expect(evaluateInvite(row as never, email, NOW)).toEqual({ ok: false, reason });
  });
  it("treats the exact expiry instant as expired", () => {
    expect(evaluateInvite(invite({ expiresAt: NOW }), "konyvelo@pelda.hu", NOW)).toEqual({ ok: false, reason: "expired" });
  });
});
