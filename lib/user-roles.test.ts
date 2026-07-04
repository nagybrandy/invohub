// lib/user-roles.test.ts
import {
  ALL_ROLES,
  canAccessAdminPanel,
  canManageClients,
  isAccountant,
  isAdmin,
  roleLabel,
  SIGNUP_ROLES,
} from "@/lib/user-roles";

describe("user-roles", () => {
  it("defines signup roles without admin", () => {
    expect(SIGNUP_ROLES).toEqual(["accountant", "entrepreneur"]);
    expect(ALL_ROLES).toContain("admin");
  });

  it("isAdmin returns true only for admin", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("accountant")).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  it("isAccountant returns true only for accountant", () => {
    expect(isAccountant("accountant")).toBe(true);
    expect(isAccountant("admin")).toBe(false);
    expect(isAccountant(undefined)).toBe(false);
  });

  it("canManageClients allows admin and accountant", () => {
    expect(canManageClients("admin")).toBe(true);
    expect(canManageClients("accountant")).toBe(true);
    expect(canManageClients("entrepreneur")).toBe(false);
  });

  it("canAccessAdminPanel allows admin only", () => {
    expect(canAccessAdminPanel("admin")).toBe(true);
    expect(canAccessAdminPanel("accountant")).toBe(false);
  });

  it("roleLabel maps known roles", () => {
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel("accountant")).toBe("Accountant");
    expect(roleLabel("entrepreneur")).toBe("Entrepreneur");
    expect(roleLabel("unknown")).toBe("User");
  });
});
