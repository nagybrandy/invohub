// lib/nav/credentials.test.ts
import { createCipheriv, randomBytes } from "crypto";
import {
  NAV_SECRET_MASK,
  NavCredentialsConfigError,
  currentNavCredentialsKeyId,
  decryptNavSecret,
  decryptNavSecretOrPassthrough,
  encryptNavSecret,
  encryptNavSecretOrNull,
  isEncryptedNavSecret,
  isMaskedNavSecret,
  isNavCredentialsEncryptionConfigured,
  maskNavSecret,
  needsNavSecretReencryption,
} from "@/lib/nav/credentials";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64"); // deterministic 32-byte key for tests
const OLD_KEY = Buffer.alloc(32, 9).toString("base64");

const ENV_KEYS = ["NAV_CREDENTIALS_KEY", "NAV_CREDENTIALS_KEY_ID", "NAV_CREDENTIALS_PREVIOUS_KEYS"] as const;

/** Builds a legacy `gcm1:iv:tag:ct` value exactly as the pre-rotation code did. */
function legacyGcm1(plain: string, keyB64: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyB64, "base64"), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["gcm1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

describe("NAV credential encryption (AES-256-GCM)", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it("reports not configured when NAV_CREDENTIALS_KEY is missing", () => {
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

  it("writes the versioned gcm2 format with the current key id (default k1)", () => {
    process.env.NAV_CREDENTIALS_KEY = TEST_KEY;
    expect(currentNavCredentialsKeyId()).toBe("k1");
    expect(encryptNavSecret("x")).toMatch(/^gcm2:k1:[^:]+:[^:]+:[^:]+$/);

    process.env.NAV_CREDENTIALS_KEY_ID = "2026b";
    expect(encryptNavSecret("x")).toMatch(/^gcm2:2026b:/);
  });

  it("rejects an invalid key id", () => {
    process.env.NAV_CREDENTIALS_KEY = TEST_KEY;
    process.env.NAV_CREDENTIALS_KEY_ID = "bad:id";
    expect(() => encryptNavSecret("x")).toThrow(NavCredentialsConfigError);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    process.env.NAV_CREDENTIALS_KEY = TEST_KEY;
    const a = encryptNavSecret("same-value");
    const b = encryptNavSecret("same-value");
    expect(a).not.toBe(b);
    expect(a.split(":")[2]).not.toBe(b.split(":")[2]);
    expect(decryptNavSecret(a)).toBe("same-value");
    expect(decryptNavSecret(b)).toBe("same-value");
  });

  it("throws on tampered ciphertext (auth tag mismatch)", () => {
    process.env.NAV_CREDENTIALS_KEY = TEST_KEY;
    const parts = encryptNavSecret("secret-value").split(":");
    parts[4] = Buffer.from("tampered-bytes-here!").toString("base64");
    expect(() => decryptNavSecret(parts.join(":"))).toThrow();
  });

  it("rejects a truncated auth tag instead of accepting a short GCM tag", () => {
    process.env.NAV_CREDENTIALS_KEY = TEST_KEY;
    const parts = encryptNavSecret("secret-value").split(":");
    parts[3] = Buffer.from(parts[3], "base64").subarray(0, 4).toString("base64");
    expect(() => decryptNavSecret(parts.join(":"))).toThrow(NavCredentialsConfigError);
  });

  it("throws for an unrecognized format", () => {
    process.env.NAV_CREDENTIALS_KEY = TEST_KEY;
    expect(() => decryptNavSecret("not-encrypted-at-all")).toThrow(NavCredentialsConfigError);
  });

  it("never puts the stored value or the plaintext into error messages", () => {
    process.env.NAV_CREDENTIALS_KEY = TEST_KEY;
    const enc = encryptNavSecret("very-secret-pw");
    process.env.NAV_CREDENTIALS_KEY = OLD_KEY; // wrong key now
    try {
      decryptNavSecret(enc);
      throw new Error("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).not.toContain("very-secret-pw");
      expect(msg).not.toContain(enc);
      expect(msg).not.toContain(enc.split(":")[4]);
    }
  });

  describe("key rotation", () => {
    it("decrypts values written under a previous key id via NAV_CREDENTIALS_PREVIOUS_KEYS", () => {
      process.env.NAV_CREDENTIALS_KEY = OLD_KEY;
      process.env.NAV_CREDENTIALS_KEY_ID = "k1";
      const oldValue = encryptNavSecret("rotated-secret");

      process.env.NAV_CREDENTIALS_KEY = TEST_KEY;
      process.env.NAV_CREDENTIALS_KEY_ID = "k2";
      expect(() => decryptNavSecret(oldValue)).toThrow(NavCredentialsConfigError);

      process.env.NAV_CREDENTIALS_PREVIOUS_KEYS = `k1:${OLD_KEY}`;
      expect(decryptNavSecret(oldValue)).toBe("rotated-secret");
      expect(encryptNavSecret("new")).toMatch(/^gcm2:k2:/);
    });

    it("reads legacy gcm1 values (no key id) with the current key or any previous key", () => {
      process.env.NAV_CREDENTIALS_KEY = TEST_KEY;
      expect(decryptNavSecret(legacyGcm1("legacy-current", TEST_KEY))).toBe("legacy-current");

      process.env.NAV_CREDENTIALS_PREVIOUS_KEYS = `old:${OLD_KEY}`;
      expect(decryptNavSecret(legacyGcm1("legacy-old", OLD_KEY))).toBe("legacy-old");
    });

    it("rejects a malformed NAV_CREDENTIALS_PREVIOUS_KEYS entry", () => {
      process.env.NAV_CREDENTIALS_KEY = TEST_KEY;
      process.env.NAV_CREDENTIALS_PREVIOUS_KEYS = "no-separator-here";
      expect(() => decryptNavSecret(legacyGcm1("x", TEST_KEY))).toThrow(NavCredentialsConfigError);
    });

    it("needsNavSecretReencryption flags plaintext, gcm1 and non-current key ids only", () => {
      process.env.NAV_CREDENTIALS_KEY = OLD_KEY;
      process.env.NAV_CREDENTIALS_KEY_ID = "k1";
      const k1 = encryptNavSecret("a");
      process.env.NAV_CREDENTIALS_KEY = TEST_KEY;
      process.env.NAV_CREDENTIALS_KEY_ID = "k2";
      const k2 = encryptNavSecret("a");

      expect(needsNavSecretReencryption(null)).toBe(false);
      expect(needsNavSecretReencryption("")).toBe(false);
      expect(needsNavSecretReencryption("legacy-plaintext")).toBe(true);
      expect(needsNavSecretReencryption(legacyGcm1("a", TEST_KEY))).toBe(true);
      expect(needsNavSecretReencryption(k1)).toBe(true);
      expect(needsNavSecretReencryption(k2)).toBe(false);
    });
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
    expect(decryptNavSecretOrPassthrough(legacyGcm1("old-format", TEST_KEY))).toBe("old-format");
    expect(decryptNavSecretOrPassthrough("legacy-plaintext-value")).toBe("legacy-plaintext-value");
    expect(decryptNavSecretOrPassthrough(undefined)).toBeUndefined();
  });

  describe("masking", () => {
    it("masks without revealing any character of the secret (and without decrypting)", () => {
      expect(maskNavSecret("gcm2:k1:aaa:bbb:ccc")).toBe(NAV_SECRET_MASK);
      expect(maskNavSecret("plain-legacy")).toBe(NAV_SECRET_MASK);
      expect(maskNavSecret(undefined)).toBeNull();
      expect(maskNavSecret("")).toBeNull();
    });

    it("recognises a mask echoed back by a client", () => {
      expect(isMaskedNavSecret(NAV_SECRET_MASK)).toBe(true);
      expect(isMaskedNavSecret("  ••••  ")).toBe(true);
      expect(isMaskedNavSecret("real-password")).toBe(false);
      expect(isMaskedNavSecret("")).toBe(false);
    });
  });
});
