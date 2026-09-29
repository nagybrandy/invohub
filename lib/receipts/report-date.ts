// lib/receipts/report-date.ts
// The NAV report day a receipt belongs to: its Europe/Budapest calendar day.
// One definition for the three places that must agree — the nightly runner
// writes nav_receipt_submission.report_date in Budapest days, so the manual
// submit route and the receipt detail lookup must derive the same key, or a
// receipt issued between midnight and 02:00 local time is looked up (and
// reported) under the previous day.
import { budapestDateKey } from "@/lib/dates/budapest";

export function receiptReportDate(issuedAt: string | Date): string {
  return budapestDateKey(new Date(issuedAt));
}
