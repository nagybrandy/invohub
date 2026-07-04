// lib/receipts/qr-payload.ts
// Builds public URL encoded in receipt QR codes.
import { getClientAuthBaseURL } from "@/lib/auth-url";

export function buildReceiptQrUrl(token: string): string {
  const base = getClientAuthBaseURL();
  return `${base}/receipts/view?token=${encodeURIComponent(token)}`;
}

export function buildReceiptQrPayload(token: string): string {
  return buildReceiptQrUrl(token);
}
