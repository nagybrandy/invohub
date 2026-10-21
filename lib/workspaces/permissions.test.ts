import { isPlatformPath, canManageAccess, canManageAdmins, normalizeApiPath, canPerform, canWrite, isInvitableRole, isWorkspaceRole } from "@/lib/workspaces/permissions";

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

describe("path normalisation — the router tolerates variants the rules must not miss", () => {
  it("strips trailing slashes, collapses // and decodes before matching", () => {
    expect(normalizeApiPath("/api/companies/")).toBe("/api/companies");
    expect(normalizeApiPath("/api//companies///")).toBe("/api/companies");
    expect(normalizeApiPath("/API/Companies")).toBe("/api/companies");
    expect(normalizeApiPath("/api/%63ompanies")).toBe("/api/companies");
    expect(normalizeApiPath("/api/%E0%A4%A")).toBe("/api/%e0%a4%a");
    expect(normalizeApiPath("")).toBe("/");
  });

  it("an accountant cannot reach credentials through a trailing-slash / case / encoding variant", () => {
    for (const path of ["/api/companies/", "/api/companies//", "/API/COMPANIES", "/api/%63ompanies", "/api/nav/check/", "/api/api-keys/", "/api//api-keys", "/api/workspaces/invites/"]) {
      expect(canPerform("accountant", "POST", path)).toBe(false);
      expect(canPerform("accountant", "PATCH", path)).toBe(false);
      expect(canPerform("viewer", "POST", path)).toBe(false);
    }
  });

  it("the same variants of an allowed route are allowed", () => {
    expect(canPerform("accountant", "POST", "/api/invoices/")).toBe(true);
    expect(canPerform("accountant", "POST", "/API/Invoices//abc/send/")).toBe(true);
  });
});

describe("accountant writes are an allowlist — an unknown or future route is closed by default", () => {
  it("denies writes to routes nobody opened for the accountant", () => {
    for (const path of ["/api/some-new-route", "/api/m2m/check", "/api/companies", "/api/dev/seed", "/api/exchange-rates/currencies/x"]) {
      expect(canPerform("accountant", "POST", path)).toBe(false);
    }
  });
  it("allows the data routes, including NAV submission but not NAV credential checks", () => {
    for (const path of ["/api/clients/abc", "/api/products", "/api/receipts/abc/send", "/api/receipts/abc/submit-nav", "/api/email-templates/x", "/api/reminders/run", "/api/notifications/read-all", "/api/payments", "/api/import/invoices", "/api/nav/submit", "/api/nav/status"]) {
      expect(canPerform("accountant", "POST", path)).toBe(true);
    }
    expect(canPerform("accountant", "POST", "/api/nav/check")).toBe(false);
    expect(canPerform("accountant", "GET", "/api/nav/check")).toBe(false); // a GET there does a live NAV token exchange
    expect(canPerform("viewer", "GET", "/api/nav/check")).toBe(false);
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
  it("only the owner manages administrators", () => {
    expect(canManageAdmins("owner")).toBe(true);
    for (const r of ["admin", "accountant", "viewer"] as const) expect(canManageAdmins(r)).toBe(false);
  });
  it("only owner/admin manage access; viewers cannot write", () => {
    expect(canManageAccess("owner")).toBe(true);
    expect(canManageAccess("admin")).toBe(true);
    expect(canManageAccess("accountant")).toBe(false);
    expect(canWrite("viewer")).toBe(false);
    expect(canWrite("accountant")).toBe(true);
  });
});
