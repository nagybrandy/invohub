// lib/nav/crypto.ts
// Low-level NAV Online Számla v3.0 crypto primitives (Node `crypto` only,
// server-side): password hashing, request signature, exchange-token
// decryption, and software id validation.
//
// Signature rule (NAV OSA 3.0 "Interfész specifikáció"):
//   requestSignature = SHA3-512(requestId + timestamp[yyyyMMddHHmmss, UTC] + signKey [+ per-invoice hashes]) , uppercase hex
// For manageInvoice, each invoice operation contributes one extra hash,
// appended in index order:
//   SHA3-512(invoiceOperation + base64(invoiceData)), uppercase hex
import { createDecipheriv, createHash } from "crypto";

export function sha512UpperHex(input: string): string {
  return createHash("sha512").update(input, "utf8").digest("hex").toUpperCase();
}

export function sha3_512UpperHex(input: string): string {
  return createHash("sha3-512").update(input, "utf8").digest("hex").toUpperCase();
}

/** yyyyMMddHHmmss in UTC, as required inside the request signature. */
export function navSignatureTimestamp(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    String(date.getUTCFullYear()) +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds())
  );
}

/** ISO-8601 UTC with milliseconds, as used in <common:timestamp>. */
export function navIsoTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

export function buildPasswordHash(password: string): string {
  return sha512UpperHex(password);
}

export type ManageInvoiceSignatureOperation = {
  operation: "CREATE" | "MODIFY" | "STORNO";
  invoiceDataBase64: string;
};

export function buildRequestSignature(params: {
  requestId: string;
  timestamp: Date;
  signKey: string;
  invoiceOperations?: ManageInvoiceSignatureOperation[];
}): string {
  const base = params.requestId + navSignatureTimestamp(params.timestamp) + params.signKey;
  const invoiceHashes = (params.invoiceOperations ?? [])
    .map((op) => sha3_512UpperHex(op.operation + op.invoiceDataBase64))
    .join("");
  return sha3_512UpperHex(base + invoiceHashes);
}

// 18 uppercase alphanumeric characters — NAV's softwareId format.
const SOFTWARE_ID_PATTERN = /^[A-Z0-9]{18}$/;

export function isValidSoftwareId(id: string | undefined | null): id is string {
  return !!id && SOFTWARE_ID_PATTERN.test(id);
}

/**
 * Decrypts NAV's tokenExchange `encodedExchangeToken` with AES-128-ECB,
 * using the company's exchange key (navXmlChangeKey) as the raw 16-byte key.
 * NAV's exchange key is a 16-character string used directly as UTF-8 key
 * bytes (no KDF, no IV — ECB is what NAV specifies for this one field).
 */
export function decryptExchangeToken(encodedExchangeTokenBase64: string, exchangeKey: string): string {
  const keyBuffer = Buffer.from(exchangeKey, "utf8");
  if (keyBuffer.length !== 16) {
    throw new Error(
      `NAV exchange key (navXmlChangeKey) must be exactly 16 bytes for AES-128 (got ${keyBuffer.length}).`
    );
  }
  const decipher = createDecipheriv("aes-128-ecb", keyBuffer, Buffer.alloc(0));
  const ciphertext = Buffer.from(encodedExchangeTokenBase64, "base64");
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
