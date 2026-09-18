// lib/nav-receipt/signature.ts
// Thin wrapper over lib/nav/crypto.ts — the NAV eRECEIPT requestSignature
// formula (spec §2.1.1.1) is byte-for-byte the same as NAV OSA's
// buildRequestSignature with no invoice operations:
//   SHA3-512(requestId + timestamp[yyyyMMddHHmmss, UTC] + signKey), uppercase hex
// Do not re-derive the hash here — see plan §1.1 for the golden vector this
// is verified against.
import { randomBytes, randomUUID } from "crypto";

import { buildRequestSignature } from "@/lib/nav/crypto";

export function buildReceiptRequestSignature(params: {
  requestId: string;
  timestamp: Date;
  signKey: string;
}): string {
  return buildRequestSignature({
    requestId: params.requestId,
    timestamp: params.timestamp,
    signKey: params.signKey,
  });
}

// AuthTokenRequest extends the NAV eRECEIPT *legacy* request shape
// (LegacyContextType), whose requestId is LegacyRequestIdType:
// pattern `[+a-zA-Z0-9_]{1,30}` — no `-`, so randomUUID() is invalid here
// (see plan §1.2, correction 1). No `/` either, so this is not base64.
const LEGACY_REQUEST_ID_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+_";
const LEGACY_REQUEST_ID_LENGTH = 20;

/** requestId for legacy (auth) NAV eRECEIPT requests — matches `[+A-Za-z0-9_]{1,30}`, never `-`. */
export function newAuthRequestId(): string {
  const bytes = randomBytes(LEGACY_REQUEST_ID_LENGTH);
  let out = "";
  for (let i = 0; i < LEGACY_REQUEST_ID_LENGTH; i++) {
    out += LEGACY_REQUEST_ID_ALPHABET[bytes[i] % LEGACY_REQUEST_ID_ALPHABET.length];
  }
  return out;
}

/** requestId for business (non-legacy) NAV eRECEIPT requests — a UUID (GenericIdType = UuidType). */
export function newServiceRequestId(): string {
  return randomUUID();
}
