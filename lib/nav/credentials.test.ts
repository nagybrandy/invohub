// lib/nav/credentials.test.ts
import {
  NavCredentialsConfigError,
  decryptNavSecret,
  decryptNavSecretOrPassthrough,
  encryptNavSecret,
  encryptNavSecretOrNull,
  isEncryptedNavSecret,
  isNavCredentialsEncryptionConfigured,
} from "@/lib/nav/credentials";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64"); // deterministic 32-byte key for tests

describe("NAV credential encryption (AES-256-GCM)", () => {
  const originalKey = process.env.NAV_CREDENTIALS_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.NAV_CREDENTIALS_KEY;
    else process.env.NAV_CREDENTIALS_KEY = originalKey;
  });

  it("reports not configured when NAV_CREDENTIALS_KEY is missing", () => {
    delete process.env.NAV_CREDENTIALS_KEY;
    expect(isNavCredentialsEncryptionConfigured()).toBe(false);
    expect(() => encryptNavSecret("sign-key")).toThrow(NavCredentialsConfigError);
  });

  it("rejects a key that isn't 32 bytes", () => {
    process.env.NAV_CREDENTIALS_KEY = Buffer.alloc(16, 1).toString("base64");
    expect(() => encryptNavSecret("sign-key")).toThrow(NavCredentialsConfigError);
  });

  it("round-trips a secret", () => {
    process.env.NAV_CREDENTIALS_KEY = TEST_KEY;
    const cipherText = encryptNavSecret("super-secret-sign-key");
    expect(isEncryptedNavSecret(cipherText)).toBe(true);
    expect(cipherText).not.toContain("super-secret-sign-key");
    expect(decryptNavSecret(cipherText)).toBe("super-secret-sign-key");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    process.env.NAV_CREDENTIALS_KEY = TEST_KEY;
    const a = encryptNavSecret("same-value");
    const b = encryptNavSecret("same-value");
    expect(a).not.toBe(b);
    expect(decryptNavSecret(a)).toBe("same-value");
    expect(decryptNavSecret(b)).toBe("same-value");
  });

  it("throws on tampered ciphertext (auth tag mismatch)", () => {
    process.env.NAV_CREDENTIALS_KEY = TEST_KEY;
    const cipherText = encryptNavSecret("secret-value");
    const parts = cipherText.split(":");
    parts[3] = Buffer.from("tampered-bytes-here!").toString("base64");
    expect(() => decryptNavSecret(parts.join(":"))).toThrow();
  });

  it("throws for an unrecognized format", () => {
    process.env.NAV_CREDENTIALS_KEY = TEST_KEY;
    expect(() => decryptNavSecret("not-encrypted-at-all")).toThrow(NavCredentialsConfigError);
  });

  it("encryptNavSecretOrNull passes through null/empty as null", () => {
    process.env.NAV_CREDENTIALS_KEY = TEST_KEY;
    expect(encryptNavSecretOrNull(undefined)).toBeNull();
    expect(encryptNavSecretOrNull("")).toBeNull();
    expect(encryptNavSecretOrNull("value")).not.toBeNull();
  });

  it("decryptNavSecretOrPassthrough decrypts encrypted values and passes through legacy plaintext", () => {
    process.env.NAV_CREDENTIALS_KEY = TEST_KEY;
    const cipherText = encryptNavSecret("plain-value");
    expect(decryptNavSecretOrPassthrough(cipherText)).toBe("plain-value");
    expect(decryptNavSecretOrPassthrough("legacy-plaintext-value")).toBe("legacy-plaintext-value");
    expect(decryptNavSecretOrPassthrough(undefined)).toBeUndefined();
  });
});
