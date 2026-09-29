// lib/nav/nav-indicator.ts
// What the NAV dot on a list row / card is allowed to claim. It used to be
// coloured by "has an invoice number" alone, under a hint that literally
// said "Valószínűleg beküldve" — a never-submitted invoice lit up blue.
// The dot now follows the LATEST nav_submission row for the document.
import { isIssuedDocument } from "@/lib/invoices/issued";

export type NavListStatus = "none" | "notSubmitted" | "inProgress" | "done" | "failed";

/** NAV's own transitional states, lower-cased the way the status check stores them. */
const IN_PROGRESS = new Set(["pending", "sent", "processing", "received", "saved"]);

export function navIndicatorFor(
  doc: { status: string; documentType?: string | null },
  latestSubmissionStatus: string | null | undefined
): NavListStatus {
  // A draft is not issued; a díjbekérő is never reported. Nothing to show.
  if (!isIssuedDocument(doc)) return "none";
  if (!latestSubmissionStatus) return "notSubmitted";
  const s = latestSubmissionStatus.toLowerCase();
  if (s === "done") return "done";
  if (s === "error" || s === "aborted") return "failed";
  // Any other value is a state NAV is still working through — including one
  // a newer client might write that this build doesn't know by name.
  return IN_PROGRESS.has(s) ? "inProgress" : "inProgress";
}
