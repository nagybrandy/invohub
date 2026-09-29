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

describe("M2M credentials — the config error must not carry the values", () => {
  const ORIGINAL_ENV = process.env;

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("names only the missing variables, never the ones that are set", () => {
    // These are real secrets in production; a "helpful" error that echoed
    // them would put them in logs, Sentry and screenshots.
    process.env = {
      ...ORIGINAL_ENV,
      M2M_CLIENT_ID: "client-id-value",
      M2M_CLIENT_SECRET: "client-secret-value",
      M2M_USERNAME: "username-value",
      M2M_PASSWORD: "password-value",
      M2M_SIGNATURE_KEY_FIRST: "signature-key-value",
      M2M_NONCE: undefined,
    } as NodeJS.ProcessEnv;

    let message = "";
    try {
      loadM2mCredentialsFromEnv();
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }

    expect(message).toContain("M2M_NONCE");
    for (const secret of [
      "client-id-value",
      "client-secret-value",
      "username-value",
      "password-value",
      "signature-key-value",
    ]) {
      expect(message).not.toContain(secret);
    }
  });
});
