// lib/auth-signup-role.test.ts
// resolveSignupRole is the single choke point that makes accepting a
// client-supplied `signupRole` at signup safe: no input, however crafted,
// can make it back anything other than "entrepreneur" | "accountant".
import { resolveSignupRole } from "@/lib/auth-signup-role";

describe("resolveSignupRole", () => {
  it("accepts entrepreneur", () => {
    expect(resolveSignupRole("entrepreneur")).toBe("entrepreneur");
  });

  it("accepts accountant", () => {
    expect(resolveSignupRole("accountant")).toBe("accountant");
  });

  it("never returns admin, even if requested", () => {
    expect(resolveSignupRole("admin")).toBe("entrepreneur");
  });

  it("falls back to entrepreneur for any other string", () => {
    expect(resolveSignupRole("superuser")).toBe("entrepreneur");
    expect(resolveSignupRole("")).toBe("entrepreneur");
  });

  it("falls back to entrepreneur for missing or non-string input", () => {
    expect(resolveSignupRole(undefined)).toBe("entrepreneur");
    expect(resolveSignupRole(null)).toBe("entrepreneur");
    expect(resolveSignupRole(42)).toBe("entrepreneur");
    expect(resolveSignupRole({ role: "admin" })).toBe("entrepreneur");
  });
});
