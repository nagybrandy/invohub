// lib/m2m/credentials.test.ts
import { isM2mConfigured, loadM2mCredentialsFromEnv, M2mConfigError } from "@/lib/m2m/credentials";

describe("loadM2mCredentialsFromEnv", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("throws when required vars are missing", () => {
    delete process.env.M2M_CLIENT_ID;
    expect(() => loadM2mCredentialsFromEnv()).toThrow(M2mConfigError);
    expect(isM2mConfigured()).toBe(false);
  });

  it("loads credentials when all vars are set", () => {
    process.env.M2M_CLIENT_ID = "client";
    process.env.M2M_CLIENT_SECRET = "secret";
    process.env.M2M_USERNAME = "user";
    process.env.M2M_PASSWORD = "pass";
    process.env.M2M_SIGNATURE_KEY_FIRST = "first";
    process.env.M2M_NONCE = "nonce";
    process.env.M2M_ENV = "test";

    const creds = loadM2mCredentialsFromEnv();
    expect(creds.clientId).toBe("client");
    expect(creds.environment).toBe("test");
    expect(isM2mConfigured()).toBe(true);
  });
});
