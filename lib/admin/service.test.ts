// lib/admin/service.test.ts
import { isAssignableRole } from "@/lib/user-roles";

describe("admin service role validation", () => {
  it("accepts admin, accountant, entrepreneur", () => {
    expect(isAssignableRole("admin")).toBe(true);
    expect(isAssignableRole("accountant")).toBe(true);
    expect(isAssignableRole("entrepreneur")).toBe(true);
    expect(isAssignableRole("hacker")).toBe(false);
  });
});
