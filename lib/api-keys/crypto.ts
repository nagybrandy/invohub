// lib/api-keys/crypto.ts
// Public/secret API key generation and secret hashing.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generatePublicKey(): string {
  return `ih_pk_${randomBytes(16).toString("hex")}`;
}

export function generateSecretKey(): string {
  return `ih_sk_${randomBytes(32).toString("hex")}`;
}

export function hashSecretKey(secretKey: string): string {
  return createHash("sha256").update(secretKey).digest("hex");
}

/**
 * Compares the presented key's digest against the stored one in constant
 * time. `===` on strings returns as soon as two characters differ, which
 * leaks how much of a guessed hash was right; the practical risk over HTTP
 * is small, but a credential check is exactly where that discipline belongs.
 *
 * A stored hash of the wrong length (a truncated or corrupted row) is
 * rejected up front — timingSafeEqual throws when the buffers differ in
 * length, and the length of a hash is not a secret.
 */
export function verifySecretKey(secretKey: string, secretHash: string): boolean {
  const expected = Buffer.from(hashSecretKey(secretKey), "hex");
  // "hex" decoding stops at the first invalid pair, so a malformed stored
  // value simply yields a short buffer and fails the length check below.
  const stored = Buffer.from(secretHash, "hex");
  if (stored.length !== expected.length) return false;
  return timingSafeEqual(expected, stored);
}
