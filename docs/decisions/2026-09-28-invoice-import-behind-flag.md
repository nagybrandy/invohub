# 2026-09-28 — Put the spreadsheet invoice import behind a deploy flag

## Context

`app/(app)/import` takes an Excel/CSV sheet and calls
`POST /api/import/invoices`, which turns every row into a **new** invoice
draft (`IMPORT-1`, …) through `upsertInvoice`. It was built early as a
way to get historical data in, but what it produces is not history: the
drafts are new documents with today's numbering context, in whatever
currency the sheet had (EUR in the demo data), and with no HUF exchange
rate — which is exactly what the invoice list's red "árfolyam hiányzik"
banner is about. The 2026-09-28 full UX review traced the banner's
affected invoices to these imports.

For an egyéni vállalkozó the real need — "my old invoices from the other
tool" — is an archive, not re-issuance. That is a different feature
(imported documents must stay outside continuous numbering and NAV
reporting) and belongs after phase 1's launch gate, not before it.

## Decision

- The import stays in the codebase but is **off by default**. One flag,
  `EXPO_PUBLIC_ENABLE_INVOICE_IMPORT=true`, turns on both the UI entry
  points (sidebar, mobile "Továbbiak" sheet, dashboard quick-jump card)
  and the API route. `lib/import/import-flag.ts` is the single reader.
- With the flag off the route answers `404 importDisabled` and the
  `/import` screen explains why it is off instead of showing the uploader.
- The navigation constants keep describing the full product; the getters
  (`getSidebarSecondaryNav`, `getMobileMoreNav`, `getDashboardFeatures`)
  drop the import unless told otherwise, so tests can exercise both.

## Consequences

- Production shows no import until someone decides it should, and nobody
  can create `IMPORT-n` drafts by accident.
- When an archive-style import is designed, it replaces this screen
  rather than extending it; the flag makes that swap a one-line removal.
- Anyone who needs the old behaviour for a demo sets the variable in
  that deploy only.
