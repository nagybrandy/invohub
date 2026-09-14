// lib/id.ts
// Generates URL-safe unique IDs for domain entities.
import { randomBytes } from "crypto";

export function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * A CSPRNG-backed, unguessable token — unlike createId() (Date.now() +
 * Math.random(), fine for a non-secret row id but not for anything an
 * unauthenticated party presents to look up a record, like a public
 * receipt-verification qrToken). 256 bits of randomness, base64url so it's
 * safe to put straight in a URL.
 */
export function createSecureToken(): string {
  return randomBytes(32).toString("base64url");
}
