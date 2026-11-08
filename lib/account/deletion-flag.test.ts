import { isAccountDeletionEnabled, isAccountDeletionUiVisible } from "@/lib/account/deletion-flag";

describe("account deletion feature flag", () => {
  it("is OFF by default", () => {
    expect(isAccountDeletionEnabled({})).toBe(false);
    expect(isAccountDeletionUiVisible({})).toBe(false);
  });
  it.each(["", "false", "1", "TRUE", "yes", "on"])("only the exact string 'true' turns it on (%p)", (v) => {
    expect(isAccountDeletionEnabled({ ACCOUNT_DELETION_ENABLED: v })).toBe(false);
    expect(isAccountDeletionUiVisible({ EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED: v })).toBe(false);
  });
  it("turns on with 'true'", () => {
    expect(isAccountDeletionEnabled({ ACCOUNT_DELETION_ENABLED: "true" })).toBe(true);
    expect(isAccountDeletionUiVisible({ EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED: "true" })).toBe(true);
  });
});
