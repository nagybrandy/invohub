// lib/invoices/document-ink.ts
// The shared ink/surface palette for the customer-facing invoice document —
// the pdfkit PDF (lib/invoices/generate-pdf.ts, lib/invoices/pdf-brand-mark.ts)
// reads `documentInk` instead of retyping a hex literal (see
// docs/plans/2026-09-21-pdf-footer-attribution-contrast.md §0). The PDF is
// the only document renderer since 2026-09-22 — the in-app preview shows
// the generated PDF itself, so preview and document cannot drift.
//
// Out of scope: app UI colour (lib/theme/tokens.ts), marketing colour
// (components/marketing/landing-theme.ts), and the user-configurable
// template.accentColor path (lib/invoices/pdf-template/defaults.ts) — this
// module is the *document* palette only.

/** The document's own background surfaces the ink is drawn on. */
export const documentSurfaces = {
  /** The page/PDF background — plain white paper. */
  paper: "#ffffff",
  /** `--mist` — party-card / soft panel background. */
  mist: "#edf2fa",
  /** `--pale-blue` — status chip / VAT note background. */
  paleBlue: "#d9e7ff",
} as const;

/**
 * Muted ink measured 6.13:1 on paper (was #8a90a6 at 3.17:1, below the
 * 4.5:1 AA floor — the bug this module fixes). Chosen over the equally
 * "AA-passing" #6b7280 (4.83:1 on paper, but only 3.87:1 on paleBlue —
 * too fragile) because #5b6178 clears AA on every documentSurfaces entry
 * with headroom (mist 5.45:1, paleBlue 4.91:1) and sits in the same
 * desaturated-navy family as `secondary` (#4a4f6a) rather than neutral
 * grey, keeping the document palette coherent. Still visibly lighter
 * than `secondary` (8.02:1) so the visual hierarchy is not flattened.
 */
export const documentInk = {
  /** Body text. 17.81:1 on paper. */
  body: "#14162b",
  /** Headings / `--navy`. 15.92:1 on paper. */
  heading: "#111f4a",
  /** `.doc-number` / `.meta-row` / `.exchange-rate-note`. 8.02:1 on paper. */
  secondary: "#4a4f6a",
  /** Footer attribution + mobile stacked-table `td::before` labels + the
   * PDF footer strip. 6.13:1 on paper — was #8a90a6 (3.17:1). */
  muted: "#5b6178",
} as const;
