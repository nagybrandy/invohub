// lib/receipts/create-input.ts
// A nyugta is szigorú számadású: its sequence number is issued by the server
// (createReceipt → generateReceiptNumber), never typed by the caller. The
// create route drops any receiptNumber that arrives in the body so an old
// client, a script or a hand-built request cannot pick or skip a number.
import type { ReceiptInput } from "@/lib/receipts/service";

export function withoutClientReceiptNumber(body: Partial<ReceiptInput>): Partial<ReceiptInput> {
  const { receiptNumber: _ignored, ...rest } = body;
  return rest;
}
