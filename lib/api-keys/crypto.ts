// lib/api-keys/crypto.ts
// Public/secret API key generation and secret hashing.
import { createHash, randomBytes } from "node:crypto";

export function generatePublicKey(): string {
  return `ih_pk_${randomBytes(16).toString("hex")}`;
}

export function generateSecretKey(): string {
  return `ih_sk_${randomBytes(32).toString("hex")}`;
}

export function hashSecretKey(secretKey: string): string {
  return createHash("sha256").update(secretKey).digest("hex");
}

export function verifySecretKey(secretKey: string, secretHash: string): boolean {
  const hash = hashSecretKey(secretKey);
  return hash.length === secretHash.length && hash === secretHash;
}
