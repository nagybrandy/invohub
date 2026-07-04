// lib/receipts/numbers.ts
// Generates sequential receipt numbers per calendar year.
export function generateReceiptNumber(existing: { receiptNumber: string }[]): string {
  const year = new Date().getFullYear();
  const prefix = `NYG-${year}-`;
  const sameYear = existing.filter((row) => row.receiptNumber.startsWith(prefix));
  const maxSeq = sameYear.reduce((max, row) => {
    const seq = Number.parseInt(row.receiptNumber.slice(prefix.length), 10);
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}
