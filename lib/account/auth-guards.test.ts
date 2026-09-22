// lib/account/auth-guards.test.ts
import {
  blockUserHardDelete,
  ClosedAccountSignInError,
  makeClosedAccountSessionGuard,
  UserHardDeleteBlockedError,
} from "@/lib/account/auth-guards";

describe("blockUserHardDelete", () => {
  it("always refuses to hard-delete a user", async () => {
    await expect(blockUserHardDelete()).rejects.toBeInstanceOf(UserHardDeleteBlockedError);
  });
});

describe("makeClosedAccountSessionGuard", () => {
  it("refuses to create a session for a closed account", async () => {
    const isClosed = jest.fn().mockResolvedValue(true);
    const guard = makeClosedAccountSessionGuard(isClosed);
    await expect(guard({ userId: "u1" })).rejects.toBeInstanceOf(ClosedAccountSignInError);
    expect(isClosed).toHaveBeenCalledWith("u1");
  });

  it("lets an active account's session through unchanged", async () => {
    const guard = makeClosedAccountSessionGuard(jest.fn().mockResolvedValue(false));
    const data = { userId: "u2", token: "t" };
    await expect(guard(data)).resolves.toEqual({ data });
  });
});
