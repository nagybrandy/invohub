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
