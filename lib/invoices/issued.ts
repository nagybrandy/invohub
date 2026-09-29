// lib/invoices/issued.ts
// The one definition of a "kiállított" (issued) document, shared by every
// figure that claims to count issued invoices — the dashboard's quarterly VAT
// estimate and the invoice list's monthly stat. They used to disagree: the
// list counted every row dated this month, drafts and díjbekérők included,
// and showed 451 584 Ft where 4 890 Ft was true.
//
// A draft is not issued yet. A díjbekérő is not a tax document, whether that
// shows in its status or its type. A cancelled original still counts: its
// storno document carries the offsetting negative lines, so dropping the
// original would subtract the same amount twice.
export function isIssuedDocument(doc: { status: string; documentType?: string | null }): boolean {
  if (doc.status === "draft" || doc.status === "proforma") return false;
  return doc.documentType !== "proforma";
}
