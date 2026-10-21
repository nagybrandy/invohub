import { isPlatformPath, canManageAccess, canPerform, canWrite, isInvitableRole, isWorkspaceRole } from "@/lib/workspaces/permissions";

describe("canPerform", () => {
  it("owner and admin can do everything an account user can", () => {
    for (const role of ["owner", "admin"] as const) {
      expect(canPerform(role, "POST", "/api/invoices")).toBe(true);
      expect(canPerform(role, "POST", "/api/companies")).toBe(true);
      expect(canPerform(role, "POST", "/api/api-keys")).toBe(true);
      expect(canPerform(role, "POST", "/api/workspaces/invites")).toBe(true);
    }
  });

  it("an accountant works with the data but not with credentials, API keys or access", () => {
    expect(canPerform("accountant", "GET", "/api/invoices")).toBe(true);
    expect(canPerform("accountant", "POST", "/api/invoices")).toBe(true);
    expect(canPerform("accountant", "PATCH", "/api/invoices/abc")).toBe(true);
    expect(canPerform("accountant", "POST", "/api/receipts")).toBe(true);
    expect(canPerform("accountant", "POST", "/api/nav/submit")).toBe(true);
    expect(canPerform("accountant", "GET", "/api/companies")).toBe(true);
    expect(canPerform("accountant", "POST", "/api/companies")).toBe(false);
    expect(canPerform("accountant", "POST", "/api/nav/check")).toBe(false);
    expect(canPerform("accountant", "GET", "/api/api-keys")).toBe(false);
    expect(canPerform("accountant", "POST", "/api/api-keys")).toBe(false);
    expect(canPerform("accountant", "DELETE", "/api/workspaces/members/x")).toBe(false);
    expect(canPerform("accountant", "GET", "/api/workspaces/members")).toBe(false); // other people's e-mail addresses
    expect(canPerform("viewer", "GET", "/api/workspaces/invites")).toBe(false);
    expect(canPerform("accountant", "POST", "/api/workspaces/invites")).toBe(false);
    expect(canPerform("accountant", "POST", "/api/dev/seed")).toBe(false);
  });

  it("a viewer can read (except API keys) and run previews, nothing else", () => {
    expect(canPerform("viewer", "GET", "/api/invoices")).toBe(true);
    expect(canPerform("viewer", "GET", "/api/invoices/abc/pdf")).toBe(true);
    expect(canPerform("viewer", "GET", "/api/api-keys")).toBe(false);
    expect(canPerform("viewer", "POST", "/api/invoices/preview/pdf")).toBe(true);
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      expect(canPerform("viewer", method, "/api/invoices")).toBe(false);
      expect(canPerform("viewer", method, "/api/invoices/abc/mark-paid")).toBe(false);
    }
    expect(canPerform("viewer", "POST", "/api/invoices/abc/send")).toBe(false);
  });

  it("is case-insensitive about the method", () => {
    expect(canPerform("viewer", "get", "/api/invoices")).toBe(true);
    expect(canPerform("viewer", "post", "/api/invoices")).toBe(false);
  });
});

describe("isPlatformPath", () => {
  it("marks the platform admin API, which ignores the account selection", () => {
    expect(isPlatformPath("/api/admin/users")).toBe(true);
    expect(isPlatformPath("/api/admin")).toBe(true);
    expect(isPlatformPath("/api/administrators")).toBe(false);
    expect(isPlatformPath("/api/invoices")).toBe(false);
  });
});

describe("role helpers", () => {
  it("recognises roles and which can be invited (not the owner)", () => {
    expect(isWorkspaceRole("owner")).toBe(true);
    expect(isWorkspaceRole("root")).toBe(false);
    expect(isInvitableRole("accountant")).toBe(true);
    expect(isInvitableRole("owner")).toBe(false);
  });
  it("only owner/admin manage access; viewers cannot write", () => {
    expect(canManageAccess("owner")).toBe(true);
    expect(canManageAccess("admin")).toBe(true);
    expect(canManageAccess("accountant")).toBe(false);
    expect(canWrite("viewer")).toBe(false);
    expect(canWrite("accountant")).toBe(true);
  });
});
