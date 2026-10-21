/** @jest-environment jsdom */
import { ACTIVE_ACCOUNT_COOKIE } from "@/lib/workspaces/active-account";
import { getActiveAccountId, resetActiveAccountMemory, setActiveAccountId } from "@/lib/workspaces/active-client";

beforeEach(() => {
  resetActiveAccountMemory();
  window.localStorage.clear();
  document.cookie = `${ACTIVE_ACCOUNT_COOKIE}=; Path=/; Max-Age=0`;
});

describe("active account (browser)", () => {
  it("is null until one is chosen, then remembered in storage and a cookie", () => {
    expect(getActiveAccountId()).toBeNull();
    setActiveAccountId("workspace-123");
    expect(getActiveAccountId()).toBe("workspace-123");
    expect(window.localStorage.getItem("invohub.activeAccount")).toBe("workspace-123");
    expect(document.cookie).toContain(`${ACTIVE_ACCOUNT_COOKIE}=workspace-123`);
  });

  it("survives a reload (reads storage when memory is empty)", () => {
    setActiveAccountId("workspace-123");
    resetActiveAccountMemory();
    expect(getActiveAccountId()).toBe("workspace-123");
  });

  it("clears the selection and the cookie when switching back to the own account", () => {
    setActiveAccountId("workspace-123");
    setActiveAccountId(null);
    expect(getActiveAccountId()).toBeNull();
    expect(window.localStorage.getItem("invohub.activeAccount")).toBeNull();
    expect(document.cookie).not.toContain("workspace-123");
  });

  it("never stores a malformed id", () => {
    setActiveAccountId("../../etc");
    expect(getActiveAccountId()).toBeNull();
    window.localStorage.setItem("invohub.activeAccount", "bad value!");
    resetActiveAccountMemory();
    expect(getActiveAccountId()).toBeNull();
  });
});
