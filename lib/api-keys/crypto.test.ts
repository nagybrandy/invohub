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
