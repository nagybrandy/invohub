// lib/api-keys/crypto.test.ts
import {
  generatePublicKey,
  generateSecretKey,
  hashSecretKey,
  verifySecretKey,
} from "@/lib/api-keys/crypto";

describe("api-keys crypto", () => {
  it("generates prefixed public and secret keys", () => {
    expect(generatePublicKey()).toMatch(/^ih_pk_/);
    expect(generateSecretKey()).toMatch(/^ih_sk_/);
  });

  it("hashes and verifies secret keys", () => {
    const secret = generateSecretKey();
    const hash = hashSecretKey(secret);
    expect(verifySecretKey(secret, hash)).toBe(true);
    expect(verifySecretKey("wrong", hash)).toBe(false);
  });
});

describe("api-keys crypto — what actually lands in the database", () => {
  it("stores a SHA-256 digest, never the secret itself", () => {
    const secret = generateSecretKey();
    const hash = hashSecretKey(secret);

    expect(hash).not.toContain(secret);
    expect(hash).not.toContain(secret.replace("ih_sk_", ""));
    // 256 bits as hex — the primitive, not just the function name
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives every generated secret its own digest", () => {
    const hashes = new Set(Array.from({ length: 50 }, () => hashSecretKey(generateSecretKey())));
    expect(hashes.size).toBe(50);
  });

  it("generates secrets with 32 bytes of randomness behind the prefix", () => {
    const secret = generateSecretKey();
    expect(secret.replace("ih_sk_", "")).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set(Array.from({ length: 50 }, generateSecretKey)).size).toBe(50);
  });

  it("rejects a hash of the right shape but the wrong value", () => {
    const hash = hashSecretKey(generateSecretKey());
    const otherHash = hashSecretKey(generateSecretKey());

    expect(verifySecretKey("ih_sk_" + "0".repeat(64), hash)).toBe(false);
    expect(otherHash).not.toBe(hash);
  });
});

describe("verifySecretKey — constant-time comparison", () => {
  // The constant-time property itself is not observable from a test — timing
  // assertions are flaky by nature, and spying on node:crypto cannot see a
  // binding the module captured at import time. What is testable is the
  // contract around it: every malformed stored value must be rejected
  // *before* it reaches timingSafeEqual, which throws on a length mismatch.

  it("returns false instead of throwing when the stored hash is the wrong length", () => {
    // timingSafeEqual throws on a length mismatch, so a truncated or
    // corrupted row must be handled before it reaches the comparison.
    const secret = generateSecretKey();

    expect(verifySecretKey(secret, "deadbeef")).toBe(false);
    expect(verifySecretKey(secret, "")).toBe(false);
  });

  it("returns false for a non-hex stored hash of the right length", () => {
    const secret = generateSecretKey();

    expect(verifySecretKey(secret, "z".repeat(64))).toBe(false);
  });

  it("still accepts the matching secret and rejects a near-miss", () => {
    const secret = generateSecretKey();
    const hash = hashSecretKey(secret);

    expect(verifySecretKey(secret, hash)).toBe(true);
    expect(verifySecretKey(secret.slice(0, -1) + "0", hash)).toBe(false);
  });
});
