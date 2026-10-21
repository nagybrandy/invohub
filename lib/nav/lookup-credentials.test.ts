import { isPlatformLookupConfigured, resolveLookupCredentials } from "@/lib/nav/lookup-credentials";

const FULL = {
  NAV_LOOKUP_LOGIN: "lookupuser",
  NAV_LOOKUP_PASSWORD: "pw",
  NAV_LOOKUP_SIGN_KEY: "sign",
  NAV_LOOKUP_CHANGE_KEY: "change",
  NAV_LOOKUP_TAX_NUMBER: "12345678-2-41",
};

describe("resolveLookupCredentials", () => {
  it("is off until every NAV_LOOKUP_* variable is set", () => {
    expect(resolveLookupCredentials({})).toBeNull();
    for (const key of Object.keys(FULL)) {
      const partial: Record<string, string | undefined> = { ...FULL, [key]: undefined };
      expect(resolveLookupCredentials(partial)).toBeNull();
      expect(isPlatformLookupConfigured(partial)).toBe(false);
    }
  });

  it("builds production credentials with an 8-digit tax number", () => {
    expect(resolveLookupCredentials(FULL)).toEqual({
      login: "lookupuser",
      password: "pw",
      signKey: "sign",
      exchangeKey: "change",
      taxNumber: "12345678",
      environment: "production",
      source: "shared",
    });
    expect(isPlatformLookupConfigured(FULL)).toBe(true);
  });

  it("can be pointed at the NAV test environment instead", () => {
    expect(resolveLookupCredentials({ ...FULL, NAV_LOOKUP_ENVIRONMENT: "test" })?.environment).toBe("test");
  });

  it("refuses an unrecognised environment instead of guessing", () => {
    expect(resolveLookupCredentials({ ...FULL, NAV_LOOKUP_ENVIRONMENT: "demo" })).toBeNull();
  });
});
