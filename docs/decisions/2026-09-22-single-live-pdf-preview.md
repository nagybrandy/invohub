# 2026-09-22 — One preview: the real PDF, live beside the composer

## Context

Owner feedback (2026-09-22):

1. The in-app preview "doesn't look the same" as the PDF, and on some
   documents (előlegszámla) text overlapped.
2. "We don't need both an HTML and a PDF preview — it's enough if, while
   editing / creating an invoice, we always see the preview on one side."

The app had two renderers for the same document: `lib/invoices/preview-html.ts`
(HTML, shown in an iframe with HTML|PDF tabs / side-by-side) and
`lib/invoices/generate-pdf.ts` (pdfkit, what the customer receives). They
drifted. Separately, the PDF header gave the document title a fixed 40% of the
page width, so "ELŐLEGSZÁMLA" wrapped to "ELŐLEGSZÁML / A" and collided with
the document number.

## Decision

- **The PDF is the only renderer.** `preview-html.ts`, the
  `GET /api/invoices/[id]/preview` route, `InvoiceDocumentPreview`,
  `ScreenModeTabs` and the HTML-only `brand-mark-svg.ts` are removed. Every
  preview (invoice detail, list drawer, composer) is `InvoicePdfPreview`,
  which embeds the generated PDF.
- **Unsaved drafts** render through `POST /api/invoices/preview/pdf`: the
  payload is parsed defensively (`lib/invoices/draft-preview.ts`) and always
  rendered as an unnumbered draft ("Piszkozat" + PISZKOZAT chip) through the
  same `buildInvoicePdfContext` + `generateInvoicePdf` as a saved invoice.
- **Composer ≥1024px:** form left, live PDF right in a sticky column
  (`ComposerSideLayout`, `composerPreviewLayout`), refreshed ~700ms after the
  last edit, keeping the previous render on screen until the next has
  painted (double-buffered iframes). <1024px: an "Előnézet" button opens the
  same PDF in a drawer. Native, and browsers without an inline PDF viewer
  (`navigator.pdfViewerEnabled === false`, e.g. Android Chrome), get an
  "open PDF" action instead of an embed.
- **PDF header:** the title/number column is sized from the measured title
  (with its character spacing), the font steps down until it fits on one
  line (max 50% of the page), and the issuer block takes the rest. Line-item
  money columns grow to their widest measured value, and a row's height
  accounts for every cell.

## Consequences / trade-off

This partly supersedes `2026-09-18-composer-items-step-full-width-grid.md`:
the side panel is shown on the items step too, as the owner asked. With the
sidebar expanded at 1440px the line-item grid gets ~620px against its 860px
minimum, so it scrolls horizontally inside its card again. The panel has a
one-click "Előnézet elrejtése" that gives the grid the full width back (the
"Előnézet" drawer button then reappears in the totals bar). If the owner
prefers the grid to win by default, `composerPreviewLayout` is the single
place to auto-hide the panel on the items step when
`composerFormColumnWidth(...) < composerGridMinWidth()`.
