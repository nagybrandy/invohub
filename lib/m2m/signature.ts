// lib/m2m/signature.ts
// NAV M2M request signature (SHA-256 + Base64 uppercase), per official Java sample.
import { createHash } from "crypto";

export function m2mUtcTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

export function generateM2mSignature(
  messageId: string,
  baseText: string,
  signingKey: string,
  date = new Date()
): string {
  const toSign = messageId + m2mUtcTimestamp(date) + baseText + signingKey;
  return createHash("sha256").update(toSign, "utf8").digest("base64").toUpperCase();
}
