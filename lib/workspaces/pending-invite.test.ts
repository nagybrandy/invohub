/** @jest-environment jsdom */
import { clearPendingInvite, rememberPendingInvite, takePendingInvite } from "@/lib/workspaces/pending-invite";

describe("pending invite", () => {
  beforeEach(() => window.localStorage.clear());
  it("keeps the token until it is cleared", () => {
    expect(takePendingInvite()).toBeNull();
    rememberPendingInvite("abc");
    expect(takePendingInvite()).toBe("abc");
    expect(takePendingInvite()).toBe("abc"); // reading does not consume it — the invite page clears it after accepting
    clearPendingInvite();
    expect(takePendingInvite()).toBeNull();
  });
});
