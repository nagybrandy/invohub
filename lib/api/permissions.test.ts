// lib/api/permissions.test.ts
import {
  forbiddenResponse,
  getSessionRole,
  requireAccountantAccess,
  requireAdminAccess,
} from "@/lib/api/permissions";

describe("permissions", () => {
  it("defaults missing role to entrepreneur", () => {
    expect(getSessionRole({ user: { id: "1" } })).toBe("entrepreneur");
  });

  it("requireAccountantAccess allows entrepreneurs to manage their partners", () => {
    expect(
      requireAccountantAccess({
        user: { id: "1", role: "entrepreneur" },
      }),
    ).toBeNull();
  });

  it("requireAccountantAccess allows admin", () => {
    expect(
      requireAccountantAccess({ user: { id: "1", role: "admin" } })
    ).toBeNull();
  });

  it("requireAdminAccess allows admin only", () => {
    expect(requireAdminAccess({ user: { id: "1", role: "admin" } })).toBeNull();
    expect(requireAdminAccess({ user: { id: "1", role: "accountant" } })?.status).toBe(
      403
    );
  });

  it("forbiddenResponse returns JSON error", async () => {
    const res = forbiddenResponse("Nope");
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Nope" });
  });
});
