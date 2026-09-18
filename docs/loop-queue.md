// docs/loop-queue.md
# InvoHub continuous completion loop queue

Base branch: `main`. Backlog is grouped by product phase (see `CLAUDE.md`
and `docs/product-roadmap.md`); within a phase, complete items top to
bottom unless a later note explicitly re-prioritizes. One backlog item = one
branch = one PR (see `.claude/skills/ship-slice/SKILL.md`).

Checkbox states: `[ ]` not started, `[x]` done, `[~] folyamatban
(claude/platform-overhaul)` actively being worked by a specific branch —
when you pick up a `[~]` item, check whether that branch already covers it
before starting a duplicate.

## Phase 0 — Stabilization

Cross-cutting hardening that doesn't belong to one feature phase. Do this
before or alongside Phase 1 items that depend on it.

- [~] folyamatban (slice/seed-demo-data-admin-endpoint-security-audit)
      Seed/demo data and admin-endpoint security audit — confirm
      `lib/seed/demo-data.ts` cannot run outside a demo context and that no
      seeded/admin account ships with a predictable or blank password
      reachable in production (`app/api/admin/**`, `lib/admin/service.ts`).
      Plan:
      `docs/plans/2026-09-14-seed-demo-data-admin-endpoint-security-audit.md`
- [ ] Reminders cron reliability — confirm `app/api/cron`/`app/api/reminders`
      + `lib/reminders/process.ts` handle retries and partial failures, not
      just the happy path
- [ ] Auth E2E test user/fixture so authenticated Playwright specs can run
      (this unblocks the Phase 1 "create→preview→PDF E2E" item below)
- [ ] Credential encryption audit across NAV, M2M, and API-key storage —
      confirm `lib/nav/credentials.ts`, `lib/m2m/credentials.ts`, and
      `lib/api-keys/crypto.ts` actually encrypt at rest (check the
      primitive, not just the file name) and never log a raw secret
- [ ] Tax-audit export size/row limit — confirm `lib/export/tax-audit.ts`
      and its API route are scoped per-user and bounded, not an unbounded
      dump
- [ ] i18n gap sweep — use `.claude/skills/i18n-sync/SKILL.md` to enumerate
      every screen still missing translation coverage and file the gaps as
      sub-items here once the sweep names them (a prior audit flagged ~11
      screens with gaps but they need re-confirming against current code
      before being listed individually). Update 2026-09-14: a
      continuous-audit pass named 9 specific screens (InvoiceCard,
      invoices list/detail, clients/[id]/edit, app/receipts/view,
      settings/api-keys, settings/pdf, products/index,
      products/[id]/edit, import/index, settings/templates) and all were
      fixed in the platform-overhaul branch — re-run the sweep fresh
      rather than assuming full coverage elsewhere.
- [ ] API key secret verification (`lib/api-keys/crypto.ts`'s
      `verifySecretKey`) compares hashes with plain `===` instead of
      `crypto.timingSafeEqual` — low practical risk since both sides are
      hashes compared over an HTTP round trip, but a real departure from
      constant-time comparison discipline in the `app/api/v1/*` auth path
      (2026-09-14 audit, security)
- [ ] Dashboard "Customer service" button (`app/(app)/dashboard/index.tsx`)
      has no `onPress` handler, unlike the neighboring incoming-invoices
      button — wire it to a support contact flow (mailto, chat widget,
      help page) or remove it until one exists (2026-09-14 audit,
      ux-desktop)
- [ ] NAV receipt-report cron has no retry and no backfill —
      `app/api/cron/nav-receipt-report+api.ts` only ever builds yesterday's
      `reportDate`, and a row left in `nav_receipt_submission` with a failed
      status is never re-sent, so one bad night silently loses that day's
      nyugta adatszolgáltatás. The obligation allows reporting until the end
      of the 3rd calendar day, so walk a bounded backfill window (missing or
      failed dates in the last 3 days) and make submission idempotent per
      (companyId, reportDate). Distinct from the reminders-cron item above.
- [ ] No error tracking or cron-failure alerting exists —
      `@opentelemetry/api` is a dependency but is imported nowhere, and
      `app/api/health+api.ts` is a bare liveness probe. Both Vercel crons in
      `vercel.json` swallow per-company failures into a JSON body nobody
      reads. Add a minimal error reporter plus an owner-facing failure
      summary (notification or email) for `/api/reminders/run` and
      `/api/cron/nav-receipt-report`; the Phase 1 launch gate explicitly
      lists monitoring.
- [ ] Self-serve data export and account deletion are missing — there is no
      route under `app/api/` and no control in `app/(app)/settings/`, yet
      `lib/legal-content.ts` already promises adattörlés/adatexportálás in
      the ÁSZF and adatkezelési drafts. Ship a per-user export (invoices,
      clients, receipts, company data) and a deletion request flow that
      keeps legally retained documents while removing/anonymizing the rest.
      (needs tax/legal sign-off — the document retention period and what may
      be deleted vs. anonymized must come from the lawyer review, not from a
      guessed number)

## Phase 1 — Core invoicing, NAV-compliant

### Prioritás (owner, 2026-09-14) — feature-first order for the dev-loop

The app's own functions and UX come first; audits, tooling and "confirm
that" items wait. Build in this order (each maps to an unchecked item below):

**New owner feedback (2026-09-16) — take this next, ahead of everything
below** — owner: "a pdf sokkal rosszabbul néz ki mint a html számla, javítsd,
és legyen ott a rendes invohubos logó" (the PDF looks much worse than the
HTML invoice — fix it, and put the real InvoHub logo in it). Confirmed by
directly rendering `buildSamplePreviewInvoice()` through both
`generateInvoicePreviewHtml` and `generateInvoicePdf` (no company set) and
comparing screenshots — this is not a matter of taste, there are concrete
bugs:
- [x] **Hungarian ő/ű render as ö/ü in the PDF** — fixed on
  `slice/pdf-embed-font-fix-ounk-umlaut`. Embedded a real Latin-Extended-A
  TrueType font (Noto Sans Regular + Bold, SIL OFL 1.1,
  `assets/fonts/pdf/`, provenance in that dir's `README.md`) via a new
  `lib/invoices/pdf-fonts.ts` (`registerDocumentFonts`/`documentFontNames`,
  registered under the non-standard names `InvoHubSans`/`InvoHubSans-Bold`
  — registering under a base-14 name like `"Helvetica"` silently falls back
  to pdfkit's built-in WinAnsi font instead of embedding the TTF, verified
  and locked in by a dedicated test). `generate-pdf.ts` and
  `pdf-layout.ts` now resolve every `doc.font(...)` call through those
  names instead of a hard-coded `"Helvetica"`/`"Helvetica-Bold"`; the old
  `toWinAnsiSafe` transliteration (`document-labels.ts`, unchanged) now
  runs only on the fallback path (font files unresolvable), logging one
  explicit `console.error` and still rendering rather than throwing.
  `scripts/prepare-server-pdf-deps.mjs` vendors the TTFs into
  `dist/server/assets/pdf-fonts/` (exits non-zero if the source files are
  missing) and `scripts/verify-pdf-vendor.mjs` fails the build unless the
  vendored runtime can actually register and embed the bundled TTF
  (asserts an `EmbeddedFont`, a `%PDF` buffer, and a `FontFile2` stream) —
  so a Vercel bundling regression fails the deploy instead of silently
  shipping mis-rendered Hungarian. New tests: `lib/invoices/pdf-fonts.test.ts`
  (real pdfkit — embedded names are non-base-14, `doc._font` is an
  `EmbeddedFont` not a `StandardFont`, the five line-item header labels fit
  their columns at every `fontScale`, fallback shape when unresolvable),
  `lib/invoices/generate-pdf.test.ts` (embedded path draws ő/ű unmodified
  and never a hard-coded Helvetica name; fallback path keeps the old
  transliteration and logs once), `lib/invoices/generate-pdf.integration.test.ts`
  (real pdfkit end to end on `buildSamplePreviewInvoice()` — `%PDF` +
  `FontFile2`). Also fixed a pre-existing test-infra bug surfaced while
  writing these: `jest-expo`'s preset installs a `TextDecoder` shim that
  only supports `"utf-8"` (for React Server Components), which made any
  test importing real `pdfkit` (→ `fontkit`) throw `Unknown encoding:
  ascii` regardless of `@jest-environment` — `jest.setup.ts` now restores
  Node's own `TextDecoder` after that shim runs, for every test file.
  `npx tsc --noEmit` and `npm run test:unit` green (200 suites / 1128 tests).
  Manual check: rendered `buildSamplePreviewInvoice()` via
  `generateInvoicePdf` with and without a `company` (client name
  `Kőfaragó Kft.` on the with-company case), `pdftoppm -png` and
  `pdftotext` both confirm correct ő/ű throughout (Kőfaragó, Vevő,
  Mennyiség, ÁFA, Fizetendő, Köszönjük, előnézetéhez) — no transliteration
  anywhere. Not tax/legal-gated (document rendering/typography only, per
  the backlog item's own risk call below) — normal Ship-phase auto-merge
  applies once green.
  Plan: `docs/plans/2026-09-16-pdf-embed-font-fix-ounk-umlaut.md`
- [x] **No real InvoHub brand mark anywhere in the PDF** — only the issuing
  company's own logo (`company.logoUrl`) or, when that's unset, a plain
  colored initials badge (`drawLogoBadge` in `lib/invoices/pdf-layout.ts`).
  The HTML preview at least has a text-only "Készült az InvoHub-bal ·
  invohub.hu" footer line (`preview-html.ts`); the PDF has no InvoHub
  branding at all — no wordmark, no mark, not even that footer text in the
  sample render. Add the actual InvoHub mark (`components/marketing/
  brand-mark-geometry.ts`'s `BRAND_MARK_DEFAULT` geometry, rendered as a
  small vector/raster asset pdfkit can draw — do not just retype the brand
  colors) to a footer/branding strip, matching the "Készült az InvoHub-bal"
  text treatment already in the HTML version.
  **Shipped 2026-09-16** on `slice/pdf-invohub-brand-mark` — draws the real
  mark natively with pdfkit vector calls (no raster/SVG asset), reading
  `BRAND_MARK_GEOMETRY[BRAND_MARK_DEFAULT]` and `landingColors.navy` /
  `.cornflower` directly (no retyped paths or colors — new
  `lib/invoices/pdf-brand-mark.ts`: `drawBrandMark` + `drawBrandLockup`, at
  `BRAND_MARK_PDF_SIZE = 18`pt). The footer strip (hairline rule, issuer's
  own `template.footerText` left, InvoHub mark + "Készült az InvoHub-bal ·
  invohub.hu" lockup right, centred when there's no issuer footer text) now
  draws on **every** buffered page via `doc.bufferedPageRange()` /
  `switchToPage` / `flushPages`, replacing the old single-page
  `contentBottom(doc, 0) + 8` call that drew 8pt below the bottom margin.
  `lib/invoices/pdf-layout.ts` gained `FOOTER_BAND_HEIGHT` (=36, was a bare
  literal) and `footerBandTop(doc)`, asserted equal to `contentBottom(doc)`
  so the footer band is exactly the band content already reserves — cannot
  collide with a mandatory Áfa tv. 169. § field by construction. HTML
  preview parity: new `components/marketing/brand-mark-svg.ts`
  (`brandMarkSvg()`, a pure string serializer, no React) inlines the same
  geometry as an `<svg viewBox="0 0 48 48" role="img" aria-label="InvoHub">`
  into `preview-html.ts`'s `.footer` div, next to the same `labels.footer`
  text — both renderings now read `BRAND_MARK_GEOMETRY[BRAND_MARK_DEFAULT]`
  directly, so switching that one constant would change both with no other
  edit (tested). New tests: `lib/invoices/pdf-brand-mark.test.ts` (fake
  recording doc — every frame/flow shape issued and deep-equal to the
  imported geometry; frame drawn in the given ink and flow in the given
  accent; a stroked shape is stroked at its `lineWidth` and never filled,
  an unstroked shape is filled and never stroked, round cap/join set with a
  per-shape override honored; save/restore balanced and colors reset
  afterwards); `components/marketing/brand-mark-svg.test.ts`;
  `lib/invoices/pdf-layout.test.ts` (the `footerBandTop`/`contentBottom`
  invariant); `lib/invoices/generate-pdf.test.ts` (attribution text drawn
  from `documentLabels()` not hard-coded; issuer `footerText` still drawn
  in the same band; footer drawn twice with a stubbed 2-page
  `bufferedPageRange`; every footer draw's `y` at or above the bottom
  margin; the mark's fill colors are exactly `landingColors.navy` /
  `.cornflower` with a template `accentColor` that can't be confused for
  either); `lib/invoices/generate-pdf.integration.test.ts` (extended —
  real pdfkit, the mark's arc/"A" path commands render without throwing,
  with and without a `company`); `lib/invoices/preview-html.test.ts`
  (extended — inline SVG present with the geometry's own `d` strings,
  `role="img"`/`aria-label="InvoHub"`, wraps inside the existing
  `@media (max-width: 560px)` block). `npx tsc --noEmit` and
  `npm run test:unit` green (202 suites / 1155 tests). Manual check (AC15):
  rendered `buildSamplePreviewInvoice()` via `generateInvoicePdf` with and
  without a `company`, `pdftoppm -png -r 150` — mark crisp and legible at
  18pt in navy/cornflower, footer strip sits clearly above the bottom
  margin with whitespace to spare, issuer footer (left) and InvoHub lockup
  (right) don't collide, and a synthetic 40-line-item invoice confirmed the
  strip repeats correctly on both pages of a 2-page document. **Side
  effect, not claimed as fixing item 3 below**: `buildSamplePreviewInvoice()`
  now renders as **1 page** instead of 2 for both the with- and
  without-company cases (was 2/2 before this slice, measured directly
  against the pre-slice code) — see the note added to item 3. Not
  tax/legal-gated (document rendering/typography only — no `lib/tax/`,
  `lib/nav/` production behaviour, `lib/m2m/`, schema, or compliance-copy
  surface touched) — normal Ship-phase auto-merge applies once green.
  Plan: `docs/plans/2026-09-16-pdf-invohub-brand-mark.md`
- [x] **Broken pagination wastes an entire page** — with the *default*
  template (short footer text "Köszönjük a bizalmat!", two line items,
  short notes), the PDF still spills onto a near-blank second page just to
  show that one footer line. Something in `contentBottom`/`ensureSpace`
  (`lib/invoices/pdf-layout.ts`) or the footer-placement logic in
  `generate-pdf.ts` (~line 336) is reserving/measuring space wrong. Fix so
  a normal 1-2 item invoice fits on one page.
  **Observation (2026-09-16, from `slice/pdf-invohub-brand-mark`, not
  fixed here per that slice's plan §9)**: replacing the old footer draw
  (`contentBottom(doc, 0) + 8` — 8pt *below* the bottom margin, drawn only
  on whichever page happened to be current) with a correct
  `footerBandTop`-anchored, buffered-pages footer pass made
  `buildSamplePreviewInvoice()` render as 1 page instead of 2, both with
  and without a `company` — measured directly (pre-slice: 2/2, post-slice:
  1/1). That's consistent with the misplaced footer call having been the
  trigger for the near-blank second page described here, but the next pass
  on this item should still verify `ensureSpace`/`contentBottom` for real
  (e.g. an invoice with enough line items to *genuinely* need a second
  page, or a template with a long custom `footerText`/`notes`) rather than
  assume the root cause is fully resolved — this item is left unchecked
  intentionally.
  **Planned 2026-09-16 (Opus).** That verification was done, and three real
  defects remain underneath the fixed symptom, each reproduced against
  `ac736d6` and rendered to PNG with `pdftoppm`: (a) content prints *through*
  the footer strip — the doc is created with `margin: 48` so pdfkit's own
  `doc.text()` auto-pagination breaks 36pt *below* the band `ensureSpace`
  reserves (seen with a 16-item invoice + long `notes`); (b) `drawTotalLine`
  returns a *fixed* `y + fontSize + 6` while drawing "Fizetendő összesen:"
  into an 80pt column, so the wrapped second line overprints the next block
  (seen on an ÁFA-exempt invoice, colliding with "Alanyi adómentes …");
  (c) the reserves are magic numbers (`90` for totals vs ~68pt measured;
  `20 + reasons*14` ignoring wrapping; `48` for a notes block of arbitrary
  height) and `ensureSpace` has no "already at the top of a page" guard — a
  24-item invoice pushes totals+notes to page 2 with ~77pt free on page 1.
  Also in scope: repeated table headers + a "folytatás" caption on
  continuation pages (a 40-item invoice's page 2 has bare rows and no column
  labels today) and an "n/m. oldal" page indicator in the footer band.
  Risk `none` (document rendering/typography only — no `lib/tax/`,
  `lib/nav/` production, `lib/m2m/`, schema, or compliance copy).
  Plan: `docs/plans/2026-09-16-pdf-broken-pagination-blank-page.md`
  **Fixed (2026-09-16, `slice/pdf-broken-pagination-blank-page`)**: folded
  the reserved footer band into the document's own bottom margin
  (`CONTENT_MARGIN_BOTTOM = PAGE_MARGIN + FOOTER_BAND_HEIGHT = 84`) so
  pdfkit's own auto-pagination and `ensureSpace()`/`contentBottom()` break
  at the same line by construction; gave `ensureSpace()` a "never reopen a
  page you're already standing at the top of" guard; replaced the fixed
  90pt totals reserve and the fixed-advance `drawTotalLine()` with measured
  geometry (`totalsColumns()`), so "Fizetendő összesen:" never wraps and no
  longer overlaps the next block; measured (not fixed) reserves for the
  exemption-reason and notes blocks; added a repeated table header + a
  "`<invoiceNumber>` · folytatás" caption on continuation pages, and a
  "{{page}}/{{total}}. oldal" footer indicator on multi-page documents.
  Measured page counts: `buildSamplePreviewInvoice()` — pre-slice 2/2
  (with/without company), post-slice **1/1**, now locked by a real-pdfkit
  regression test (`BASELINE_PAGE_COUNT` tightened from `<= 2` to `=== 1`).
  A 16-item invoice with a ~2000-char `notes` value and a 40-line-item
  invoice both verified (via `pdftoppm` PNG render) to never print content
  over the footer strip on any page, and the 40-item invoice correctly
  repeats the column header + draws the folytatás caption on its
  continuation page. Plan:
  `docs/plans/2026-09-16-pdf-broken-pagination-blank-page.md`.
- [ ] **Ship-review follow-up (low, `slice/pdf-broken-pagination-blank-page`,
  2026-09-16)** — `lib/invoices/generate-pdf.test.ts` line 489 claims the
  empty-`footerText` centred-lockup branch (`drawFooterOnCurrentPage`,
  align:"center") "is covered elsewhere," but no such test exists anywhere
  in the repo; the other `footerText:""` occurrences
  (`build-pdf-context.test.ts`, `preview-html.test.ts`,
  `usePdfTemplate.test.tsx`) test unrelated code. The branch itself is
  unchanged from `main` (confirmed via diff), so this is a stale/incorrect
  test-coverage comment, not a functional regression. Either add a test
  asserting `drawBrandLockup` is called with `align:"center"` and no
  left/right footer text when `template.footerText === ""`, or reword the
  comment to say the branch is unmodified from `main`.
- [ ] **Ship-review follow-up (low, `slice/pdf-broken-pagination-blank-page`,
  2026-09-16)** — the notes-only continuation page (e.g. page 2 of a
  16-item + ~2000-char-notes invoice) has no invoice-number/context
  heading: page 1 shows the table/totals/"Megjegyzés:" label plus the
  footer "1/2. oldal", but page 2 is bare continued paragraph text with
  only "2/2. oldal" in the footer — no "folytatás" banner, no repeated
  "Megjegyzés:" label. `drawContinuationCaption` (`generate-pdf.ts`, ~lines
  351-369) is wired only into the line-item loop, not the notes block
  (~lines 495-520). Matches AC11 as written (scoped to line-item pages), so
  not an AC violation — optional follow-up: draw the same
  "`<invoiceNumber>` · folytatás" banner (or a lighter "Megjegyzés
  (folytatás)" variant) at the top of a notes-only continuation page.
- [ ] **Ship-review follow-up (low, `slice/pdf-broken-pagination-blank-page`,
  2026-09-16)** — no note needed for app-level action: this slice only
  touched `lib/invoices/{generate-pdf.ts,pdf-layout.ts,*.test.ts}` and
  `lib/i18n/locales/`, no `app/` or `components/` screens, so the standard
  Playwright screen-viewport audit doesn't apply here. Future ux-reviewer
  passes on backend-only PDF-generation slices like this should skip or
  rescope the screen-viewport audit rather than flag its absence.
- [x] **General layout gap vs. the HTML preview** — the PDF's content area
  is sparse (lots of empty vertical space, thin single-column line-item
  table, no card/section framing) next to the HTML preview's denser,
  card-based, visually finished layout. Doesn't need to be pixel-identical
  (pdfkit isn't CSS), but should read as the same product/brand — reference
  `preview-html.ts`'s section structure (VEVŐ card, line-item table styling,
  totals block) for what "finished" looks like here.
Acceptance: render `buildSamplePreviewInvoice()` (both with and without a
`company`) through `generateInvoicePdf`, convert to PNG (`pdftoppm`, already
available locally) and visually confirm: correct ő/ű glyphs throughout, the
InvoHub mark visible, single-page output for the default template, and a
layout that doesn't look like a placeholder next to the HTML preview. Not
tax/legal-gated (this is document rendering/typography, not NAV/tax logic
or compliance copy) — normal Ship-phase auto-merge applies once green.
      **PR opened 2026-09-16** (`slice/pdf-layout-general-improvement`,
      commit `b2a250f`) — not merged, pending review sign-off. `npx tsc
      --noEmit` and `npm run test:unit` (202 suites / 1210 tests) are green
      on the branch; a manual `pdftoppm` render of the sample invoice with
      and without a company confirms the tinted party cards, filled table
      header with a Nettó column, per-row hairlines and the framed/
      emphasised totals block all render correctly on one page. No new
      low-severity findings. One operational note: the fix-round commit
      briefly landed on a differently-named branch
      (`fixround2-pdf-layout-general-improvement`) because
      `slice/pdf-layout-general-improvement` was already checked out in a
      stale worktree; reconciled by fast-forwarding that worktree's branch
      to the fix commit (clean fast-forward, nothing lost) before pushing
      and opening the PR. See
      `docs/audits/loop/2026-09-16-pdf-layout-general-improvement/REPORT.md`.

**New owner feedback (2026-09-15, take next once the in-flight Díjbekérő
slice ships)** — direct visual complaints, not yet triaged into concrete
acceptance criteria; the next Plan pass should look at these with fresh
screenshots before writing a fix plan:
- [x] "a timeline csúnya" — the invoice-detail status timeline
  (`components/invoices/InvoiceTimeline.tsx`, placed above the document
  preview per D6) looks bad. **Fixed 2026-09-15** on
  `slice/invoice-timeline-visual-fix` — no interactive screenshot tool was
  available in this environment, so this was diagnosed by reading the
  className structure against `lib/invoices/status-visuals.ts` and
  `components/invoices/composer/ComposerStepper.tsx` (the app's other
  stepper) rather than from a fresh screenshot; **a human visual check at
  1440px/375px across draft/sent/overdue/paid/cancelled is still
  recommended before the next deploy**, since no image was actually
  rendered. Two confirmed structural bugs found and fixed:
  (1) the "current" step (e.g. an on-time sent invoice's "due" step) was
  styled with `border-destructive`/`text-destructive` — the same red/error
  color the app reserves for a genuine problem (`STATUS_VISUALS.overdue`).
  Every normal sent-but-not-yet-due invoice therefore showed an alarming
  red step for no reason. Destructive styling is now applied only when the
  due step is actually overdue (`isOverdue()`); the plain "current" state
  now uses `border-primary`/`text-primary`, matching
  `STATUS_VISUALS.sent` and `ComposerStepper`'s `bg-primary` "current step"
  treatment. (2) the steps row used `flex-wrap` with a `min-w-[140px]` per
  step, which wraps onto two rows at 375px (2+2) — the leading connector
  line of the wrapped-down third step then dangles with nothing above it
  to connect to, since the connector's color/position assumes a single
  row. Removed the wrap/min-width so the row stays a single line at any
  width (labels/dates wrap internally instead). Also made the connector
  line into the *active* step read as "reached" (primary) rather than grey,
  so the progress line doesn't visually stop one step short of the
  highlighted node. New tests in `InvoiceTimeline.test.tsx` assert the
  current/overdue color split, the connector fill, and the non-wrapping
  container class. `npm run typecheck` and `npm run test:unit` green (197
  suites / 1109 tests).
- [x] "a számla aloldalakon a gombok csúnyán helyezkednek el" — button
  layout on invoice sub-pages is poor. **Fixed 2026-09-15** on
  `slice/invoice-subpage-button-layout` — again, no interactive
  screenshot tool was available, so this was diagnosed structurally from
  the className/JSX tree, cross-checked against `components/layout/
  PageHeader.tsx` (the app's own established primary/secondary/overflow
  action-row pattern) and every other icon-in-`Button` call site; **a
  human visual check at 1440px/375px is still recommended** before the
  next deploy. Findings, scoped to `/invoices/[id]` (detail):
  `components/layout/DangerZone.tsx` and `components/layout/
  OverflowMenu.tsx` were already fine (consistent sizing, proper
  destructive-last ordering, sane wrap behavior) — the actual bug was one
  level up, in `components/invoices/InvoiceMoneyHeader.tsx`'s action
  slot, used only by the detail screen: primaryAction (a full default-size
  `Button`) and secondaryAction (a `size="sm"` mark-paid `Button` +
  `OverflowMenu` trigger) were stacked in a `VStack items-end` column —
  two visually different-weight rows crammed together instead of one
  coherent row, and on narrow screens the outer `HStack`'s
  `justify-between` + `flex-wrap` left that column at its own intrinsic
  (left-pinned) width once it wrapped onto its own line below the money
  block, instead of spanning full-width and staying right-aligned.
  Replaced it with a single horizontal, wrapping `HStack` (`w-full
  flex-wrap items-center justify-end gap-2 md:w-auto`) — matching
  `PageHeader`'s own action-row convention exactly instead of inventing a
  second one — with the secondary/overflow items first and the solid
  primary action last/rightmost. Also fixed the mark-paid button's
  `CheckCircle2` icon, the only icon-in-a-`Button` in the codebase with no
  explicit theme color (every other one — dashboard's `Inbox`,
  `M2mDemoCard`'s `RefreshCw`, the composer's `ChevronUp`/`Down` — passes
  `color` from `useIconColors()` or a variant-matched literal); it now
  gets `icons.foreground`. `/invoices/[id]/edit` renders the same shared
  `InvoiceComposer` as invoice creation — its own header/footer action
  rows (desktop top bar, mobile sticky footer, and `ComposerStepper`) were
  reviewed and are already consistent (matching sizes, sane wrap,
  destructive/current color split already correct), so left unchanged.
  New/updated tests: `InvoiceMoneyHeader.test.tsx` (single-row action
  layout, no-actions case), `__tests__/screens/invoice-detail.test.tsx`
  (icon color present). `npm run typecheck` and `npm run test:unit` green
  (197 suites / 1112 tests).

0. [x] **App UX/UI overhaul (desktop first, then mobile)** — owner, 2026-09-14
   evening: "the app has a lot of UX/UI problems on desktop: invoice creation
   is complicated, it's hard to see what is where, the in-app menu isn't
   clear, and it isn't pretty — fix these first." Handled as a dedicated
   multi-track workflow (`.claude/workflows/app-ux-overhaul.js`), not as one
   slice: information architecture + app shell/menu, invoice creation
   redesign, list/detail/dashboard polish, visual system. Items 1, 7 and 8
   below are absorbed by it. **Shipped 2026-09-15** — see
   `docs/audits/ux-overhaul-2026-09-14/REPORT.md` for what changed per
   track, screenshots, and what's still open.
1. [x] Invoice creation flow: step/accordion flow on mobile, fewer fields before
   line items (`app/(app)/invoices/new.tsx`) — absorbed by item 0. **Shipped**
   — shared 3-step composer (Partner → Tételek → Ellenőrzés & küldés, one
   step at a time on mobile) in `components/invoices/composer/`.
2. [x] **Invoice document preview/PDF is English and unbranded**
   (`lib/invoices/preview-html.ts`) — inserted here 2026-09-15 per the UX
   overhaul audit's explicit recommendation ("Ajánlott a következő
   queue-tétel legyen"): the sticky composer preview and the finalized
   invoice's "Előnézet" both render "DRAFT", "Status: unpaid", "Bill to:",
   "Description/Qty/Unit/VAT/Total" with no InvoHub branding — this is the
   literal document a Hungarian customer receives. Hungarianize + brand it
   (navy/cornflower, InvoHub wordmark, Hungarian field labels, correct
   status text) to match the app's own new visual system.
   Plan: `docs/plans/2026-09-15-hungarianize-brand-invoice-preview-pdf.md`
   (risk: **tax-legal** — PR for human sign-off, no auto-ship)
   **Implemented 2026-09-15** on `slice/hungarianize-brand-invoice-preview-pdf`
   — `npx tsc --noEmit` clean, `npm run test:unit` green (188 suites/981
   tests). Two of the plan's own acceptance criteria are internally
   inconsistent as literally worded, so they're implemented against the
   *correct*, self-consistent reading instead of the literal string —
   flagged for the PR reviewer:
   (a) AC3 says `formatDocumentAmount(1234.5, "EUR") === "1 234,56 €"`, but
   1234.5 rounded to 2 decimals is 1234,50, not ,56 — implemented as
   `"1 234,50 €"` (verified against `Intl.NumberFormat("hu-HU")`).
   (b) AC15 lists literal `"Vevő"` / `"Fizetési határidő"` (containing ő)
   as required PDF `mockDrawnTexts` entries, which directly contradicts
   AC16 ("every string in mockDrawnTexts satisfies isWinAnsiSafe") since
   `isWinAnsiSafe` is false for any string containing ő/ű — implemented so
   *every* string reaching pdfkit, labels included, goes through
   `toWinAnsiSafe` (matching the plan's own prose: "on every string drawn
   into the PDF, labels and user data alike"), so the PDF draws `"Vevö"` /
   `"Fizetési határidö"`, not the literal AC15 spelling.
   **Reviewed and merged 2026-09-15 (owner sign-off).**
3. [x] (slice/non-huf-invoice-exchange-rate-nav-xml)
   **Non-HUF invoices: use `invoice.exchangeRate` for the HUF VAT base in the
   NAV XML and on the PDF** (`lib/nav/invoice-xml.ts`,
   `lib/invoices/build-pdf-context.ts`) — implemented: a new
   `lib/invoices/exchange-rate.ts` resolves/validates the rate and converts
   document-currency amounts to HUF (per line, then summed — never
   converting an already-summed total, so NAV's cross-sum check holds);
   `buildNavInvoiceXml` now emits the real `<exchangeRate>` and every
   `…HUF` element from it, and **throws** (no `navSubmission` row written,
   `client.manageInvoice` never called) for a non-HUF invoice with no usable
   rate instead of silently reporting a false HUF VAT base. The create path
   (`POST /api/invoices`, `POST /api/v1/invoices` via
   `create-from-payload.ts`) now actually persists the rate it collects, and
   the composer blocks save on a missing/invalid rate before it ever reaches
   the API. The EUR document (HTML preview + PDF) now shows the rate used
   and the VAT amount in forint next to the EUR VAT amount, wired into the
   already-Hungarianized/branded preview and PDF (`lib/invoices/
   document-labels.ts`'s new `exchangeRate` / `exchangeRateValue` /
   `vatInHuf` keys) rather than the plain-English placeholder this slice
   was written against — done as part of merging this slice with
   `slice/hungarianize-brand-invoice-preview-pdf` on 2026-09-15, since both
   touched the same renderer functions independently. All 16 plan
   acceptance criteria pass; `npx tsc --noEmit` and `npm run test:unit` are
   green.
   Plan: `docs/plans/2026-09-15-non-huf-invoice-exchange-rate-nav-xml.md`
   (risk: **tax-legal** — PR for human sign-off, no auto-ship; the plan's
   OQ-1/OQ-2/OQ-3 — which date's rate governs, whether the HUF VAT amount
   must round to whole forint, and the document wording — are open
   questions for that sign-off, not resolved in code)
   **Shipped 2026-09-15. Reviewed and merged 2026-09-15 (owner sign-off).**
4. [x] (slice/nav-xml-payment-method-date) **Shipped 2026-09-15**
   Payment method + payment date into the NAV XML (`paymentMethod`, `paidAt`)
   Plan: `docs/plans/2026-09-15-nav-xml-payment-method-date.md`
   (risk: **tax-legal** — PR for human sign-off, no auto-ship). Planning
   verified against the published `invoiceData.xsd`/`invoiceBase.xsd` that
   this item's `paidAt` premise is **wrong**: `paymentDate` is "Fizetési
   határidő" (the due date, which the builder already emits correctly), and
   OSA 3.0 has **no** element for the actual payment date — so `paidAt`
   stays out of the XML and the slice is really about `paymentMethod`
   (TRANSFER/CASH/CARD/OTHER) plus date-shape normalization. Merged into
   `main` together with priority #3's exchange-rate work on 2026-09-15;
   `<invoiceDetail>` now emits `currencyCode`, `exchangeRate`,
   `paymentMethod`, `paymentDate` in that verified schema order.
5. [~] folyamatban (slice/dijbekero-proforma-to-invoice-flow)
   Díjbekérő (proforma) → real flow: DBK number, "Számla készítése ebből"
   action that converts to a final invoice (`lib/invoices/numbering.ts`, detail screen)
   **Round 2.** The literal checkbox already shipped in PR #15
   (`slice/dijbekero-convert-to-invoice-impl`, merged 2026-09-15) —
   numbering, the pure build, the route and both entry points exist, and
   storno/helyesbítő are already refused on a díjbekérő at both the API and
   the detail screen. Planning verified that on `main` today. This round
   closes the four open ship-review findings filed against that merge (the
   double-convert race, the missing AC20 links-card test, the redundant
   nested `runAction("convert", …)`, and a cancelled prior conversion
   rendering identically to a live one) and adds the piece of real EV value
   the first round left out: a díjbekérő that has already been invoiced is
   indistinguishable from an open one in the list, so "which díjbekérők
   still need a számla?" cannot be answered without opening each one. The
   race fix is a **partial unique index** rather than a transaction —
   `db/index.ts` uses the Neon **HTTP** driver, which has no interactive
   transaction, so the DB itself has to arbitrate and the route maps the
   23505 violation onto the 409 path it already returns.
   Plan: `docs/plans/2026-09-18-dijbekero-proforma-to-invoice-flow.md`
   (risk: **schema** — one additive partial unique index; not tax/legal, so
   Ship may auto-merge when green, but see the plan §5 caveat: creating a
   unique index fails if the race has already produced a duplicate in
   production, and that is a human decision, not a force-push).
   The díjbekérő disclaimer ("nem számla, áfa levonására nem jogosít")
   stays out of scope and sign-off-gated, as in the 2026-09-15 plan.
6. [x] Partially-paid invoice past due date surfaces as overdue (status
   derivation) — **Shipped 2026-09-15** on
   `slice/dashboard-overdue-partially-paid`. See the matching detailed
   entry below (under "Remaining for the launch gate") for what was
   actually wrong and fixed.
7. [~] needs sign-off (PR) (slice/e-nyugta-nav-receipt-api)
   e-nyugta: real NAV eRECEIPT API (nav-gov-hu/eRECEIPT spec v1.3 / XSD
   1.1.1, test base https://bv-receipt-if.enyugta.nav.gov.hu/v1) behind
   demo/test modes — slice 1 of 3 (auth token + `/receipt/create` + the
   XSD-shaped payload rebuild). **PR opened 2026-09-18.**
   Plan (slice 1 of 3): `docs/plans/2026-09-18-e-nyugta-nav-receipt-api.md`
   (risk: **tax-legal** — PR for human sign-off, no auto-ship). Supersedes
   the 2026-09-16 plan, which was never built. See the matching detailed
   entry under "Remaining for the launch gate" for what planning verified
   against the published spec/XSD.
8. [x] Invoice-flow tap targets: inline pill buttons and the notification bell ≥44px
   — **Shipped** (`slice/invoice-flow-tap-targets-44px`). New
   `lib/ui/tap-target.ts` (`MIN_TAP_TARGET_PX`, `TAP_TARGET_MIN_H`,
   `TAP_TARGET_ICON_BOX`) is the single source of truth; a new
   `components/ui/choice-pill/` primitive (`ChoicePill`/`ChoicePillGroup`,
   deliberately composed with a plain template literal instead of
   `tva()`/twMerge so a caller's conflicting className can't strip the 44px
   floor) now backs `VatCategoryPicker`'s common/advanced/rate pills, the
   notification-bell 44×44 tap box + `hitSlop={8}` in `MobileAppHeader.tsx`
   (badge re-offset inside the box), `StepPartner`'s deadline/payment-method/
   currency pills, `DocumentTypeTabs`/`ScreenModeTabs`/`ComposerStepper`, and
   the new `components/invoices/InvoiceFilterChips.tsx` (extracted from
   `app/(app)/invoices/index.tsx`'s inline `FILTERS.map`, which also fixes
   the dead "Egyéb (n)" chip — it had no `onPress` and looked identical to a
   working filter; it's now a non-interactive, visually distinct element).
   Plan: `docs/plans/2026-09-18-invoice-flow-tap-targets-44px.md` (risk:
   **none** — no `lib/tax/`, NAV/M2M, tax figure, marketing copy, or schema
   change). Follow-up filed: `components/invoices/LineItemEditor.tsx` (dead
   code superseded by `composer/VatCategoryPicker.tsx` — the loop-queue's
   original file reference below was stale) still needs deleting; out of
   scope for this slice.
   Ship-review follow-ups (low severity, from the 2026-09-18 ship review of
   `slice/invoice-flow-tap-targets-44px`):
   - [ ] `components/ui/choice-pill/index.tsx`'s code comment claims the
     caller-className-after-base ordering "always wins" the 44px floor, but
     the test (`index.test.tsx`, "always renders min-h-11 and items-center,
     even when the caller passes a conflicting className") only asserts
     `className.trim().endsWith(TAP_TARGET_MIN_H)` — string order, not
     actual rendered/computed CSS cascade behavior (NativeWind on web
     resolves same-specificity utility conflicts via stylesheet rule order,
     not attribute string order). Soften the comment to describe what's
     actually guaranteed (string order + test coverage), and track a real
     computed-style/visual check (e.g. in the Playwright UX sweep) as the
     follow-up that verifies the assumption.
   - [ ] `components/navigation/MobileAppHeader.tsx`'s new `hitSlop={8}` on
     the notification bell (required by this slice's AC9) now meets
     `LanguageSwitcher`'s pre-existing `hitSlop={8}` across their shared
     `HStack space="sm"` (8px) gap, creating a roughly 4px contested
     touch band at the boundary where RN's hit-test (not visual proximity)
     decides which control a tap there hits. Fix with an asymmetric
     hitSlop on the bell (exclude the side facing the switcher) or widen
     the gap between the two controls.
   - [ ] This slice's branch is a single squashed commit
     (`git log main..slice/invoice-flow-tap-targets-44px`), so TDD
     red→green test-first ordering (AGENTS.md §9) can't be independently
     confirmed from git history — only inferred from test specificity
     (e.g. the hostile-className cascade test, the `StepPartner`
     `exchangeRate` focusField describe block). Not blocking, but if
     test-first provenance needs to stay auditable, keep WIP/red-green
     commits on future slices or note the ordering explicitly in the PR
     description.
9. [x] Invoices empty-state CTA: replace "Load demo data" with "Első számla
   kiállítása" (demo seed stays behind the dev flag). **Shipped** — the
   `/invoices` empty state now actions straight to `routes.newInvoice`
   (`t("nav.newInvoice")`) instead of routing to Settings' demo-seed
   control.
10. Backfill/surface non-HUF invoices with no `exchangeRate` — filed by item 3
    (`slice/non-huf-invoice-exchange-rate-nav-xml`): before that slice,
    `POST /api/invoices` silently dropped `body.exchangeRate` on create, so
    any EUR/non-HUF invoice created before the fix was saved with no rate.
    Such a row now can't be NAV-submitted (`buildNavInvoiceXml` correctly
    refuses instead of reporting a false HUF base) until it's edited to add
    one. Needs a listing (which existing invoices are affected) or an
    in-app prompt on the invoice detail/edit screen — not a guessed rate.
    Also out of scope for that slice, needs its own item: retro-correcting
    any non-HUF invoice already reported to NAV with the old hardcoded
    `exchangeRate=1` (a NAV MODIFY submission question, tax/legal-gated).


Launch gate (see `docs/product-roadmap.md`): Hungarian invoicing rules
verified against Áfa tv. 169. §, NAV OSA end-to-end certified with test
credentials, security/privacy review passed.

Already shipped:
- [x] Dashboard overdue vs outstanding + VAT from line items
- [x] Saved invoice PDF preview via credentialed blob URL
- [x] New invoice: client picker, company bank prefill, email/NAV on send,
      notes meta
- [x] Server-side invoice list status + search filters
- [x] Login polish + HU/EN language switcher + EV-first nav order
- [x] Floating transparent marketing nav, HU/EN marketing copy fixes,
      cookie-consent CTA

Remaining for the launch gate:
- [ ] Authenticated create→preview→PDF E2E (blocked on the Phase 0 auth
      test-user item above)
- [x] AAM/TAM/fordított adózás review — confirm invoice VAT-treatment text
      and 0%-VAT handling match `.claude/skills/hu-invoicing-rules/SKILL.md`
      (mark anything the skill flags "ellenőrizendő" as needing human tax
      sign-off before closing this item)
      (Implemented in the 2026-09-14 platform overhaul — see docs/audits/2026-09-14/REPORT.md. Formal Hungarian tax-professional verification is still part of the Phase 1 launch gate, tracked there, not here.)
- [x] Invoice numbering sequence — confirm gapless, concurrency-safe
      numbering (a DB-level sequence/constraint, not just an in-app
      counter) in `lib/invoices/` / `db/schema.ts`
      (Implemented in the 2026-09-14 platform overhaul — see docs/audits/2026-09-14/REPORT.md. Formal Hungarian tax-professional verification is still part of the Phase 1 launch gate, tracked there, not here.)
- [x] Payment fields completeness — payment method, bank account, due-date
      handling reviewed end to end (`lib/payments/`, `db/schema.ts`)
      (Implemented in the 2026-09-14 platform overhaul — see docs/audits/2026-09-14/REPORT.md. Formal Hungarian tax-professional verification is still part of the Phase 1 launch gate, tracked there, not here.)
- [x] Storno / helyesbítő correction linkage — correction and cancellation
      invoices must reference the original invoice id and remain
      NAV-reportable, not just an internal note
      (Implemented in the 2026-09-14 platform overhaul — see docs/audits/2026-09-14/REPORT.md. Formal Hungarian tax-professional verification is still part of the Phase 1 launch gate, tracked there, not here.)
- [x] Invoice edit screen for draft/unsent invoices
      (Implemented in the 2026-09-14 platform overhaul — see docs/audits/2026-09-14/REPORT.md. Formal Hungarian tax-professional verification is still part of the Phase 1 launch gate, tracked there, not here.)
- [x] NAV OSA 3.0 real client wiring with an explicit demo/test/production
      mode switch surfaced in settings (never defaulting to production)
      (Implemented in the 2026-09-14 platform overhaul — see docs/audits/2026-09-14/REPORT.md. Formal Hungarian tax-professional verification is still part of the Phase 1 launch gate, tracked there, not here.)
- [x] NAV submission status polling UI — poll transaction status after
      submit and surface rejection reasons, not just a boolean
      (Implemented in the 2026-09-14 platform overhaul — see docs/audits/2026-09-14/REPORT.md. Formal Hungarian tax-professional verification is still part of the Phase 1 launch gate, tracked there, not here.)
- [x] Company lookup via NAV `queryTaxpayer` to auto-fill buyer/company
      details instead of manual entry only
      (Implemented in the 2026-09-14 platform overhaul — see docs/audits/2026-09-14/REPORT.md. Formal Hungarian tax-professional verification is still part of the Phase 1 launch gate, tracked there, not here.)
- [x] NAV `<invoiceReference>` block for STORNO/MODIFY submissions —
      `lib/nav/invoice-xml.ts`'s `buildNavInvoiceXml` now emits it
      (originalInvoiceNumber/modifyWithoutMaster/modificationIndex, in that
      element order) as the first child of `<invoice>`, before
      `<invoiceHead>`. Verified against the real element name/order/nesting
      by fetching `invoiceData.xsd` from nav-gov-hu/Online-Invoice directly
      (`InvoiceReferenceType`, referenced as `invoiceReference` inside
      `InvoiceType`'s sequence) — not guessed. Also corrected a wrong
      assumption in the earlier comment: `invoiceCategory` (kept as
      "NORMAL") is unrelated to create/modify/storno — that axis is the
      manageInvoice operation attribute, already handled correctly.
      `lib/nav/submit-outgoing.ts` resolves the referenced invoice's real
      NAV invoiceNumber (via `lib/invoices/service.ts#getInvoiceById`, not
      the internal id) and sets `modifyWithoutMaster` from whether that
      original ever reached a "done" NAV status
      (`lib/nav/submission-history.ts`), rejecting the submission outright
      if the reference is missing or unresolvable rather than silently
      submitting invalid XML. Not yet exercised against a real NAV test
      account (needs `NAV_TEST_*` configured — see docs/nav-test-setup.md)
      — do a real storno/modify test submission once that's set up, as a
      final check before relying on this for production.
- [ ] NAV OSA round-trip verification — close the loop on whether submitted
      invoice data actually arrives at NAV correctly, not just that
      `manageInvoice` returns without error. Two parts:
      (1) implement `queryInvoiceData` in `lib/nav/real-client.ts` /
      `lib/nav/types.ts` (currently missing — the only NAV op that reads
      back exactly what NAV stored for a submitted invoice number), then
      extend `scripts/nav-check.mjs` (or a new script/test) into a real
      round trip against the already-configured `NAV_TEST_*` account:
      `manageInvoice` a real test invoice → poll `queryTransactionStatus`
      until DONE → `queryInvoiceData` → assert the returned data matches
      what `buildNavInvoiceXml` sent, field by field, across a fixture
      matrix (AAM/TAM/fordított adózás, storno, helyesbítő/modify, non-HUF
      exchange rate, payment method/date). (2) validate `buildNavInvoiceXml`
      output against NAV's published `invoiceData.xsd`/`invoiceBase.xsd`
      before submission, as a network-free check catching structural
      regressions on every change. Directly closes the open items in
      `docs/nav-test-setup.md` ("Nyitott kérdések" — full `manageInvoice`
      round trip never tested with a real test account) and is part of the
      Phase 1 launch gate ("NAV OSA end-to-end certified with test
      credentials") below. (2026-09-15, from chat)
- [x] Invoice creation (`app/(app)/invoices/new.tsx`) is one long, flat
      scroll with ~16 fields and no sectioned/step flow on mobile —
      consider a step/accordion flow (Recipient → Dates/Payment → Line
      items) or collapsing less-common fields behind "more options" to
      shorten the pre-line-items scroll distance. (ux-mobile)
      Plan: `docs/plans/2026-09-14-invoice-creation-step-flow-mobile.md`
      **Shipped 2026-09-15** by the app UX overhaul (item 0 above): a
      shared 3-step composer (`components/invoices/composer/`) — Partner →
      Tételek → Ellenőrzés & küldés — renders one step at a time on mobile
      with a sticky total bar; desktop shows the same steps in a 2-column
      layout with a persistent summary/preview panel. Superseded this
      item's original "accordion" design decision (the shipped shape is a
      stepper, not an accordion) — see
      `docs/design/app-ux-spec-2026-09-14.md` §2 for the as-built spec.
- [x] Notification bell tap target (`components/navigation/
      MobileAppHeader.tsx`) is ~42px, just under the 44px minimum — bump
      padding to p-3 or add hitSlop (2026-09-14 audit, ux-mobile)
      **Shipped** by item 8 above (`slice/invoice-flow-tap-targets-44px`):
      the bell now renders `TAP_TARGET_ICON_BOX` (`h-11 w-11 items-center
      justify-center`) plus `hitSlop={8}`.
- [x] Multiple inline-choice pill buttons across the invoice flow are
      under the 44px tap-target minimum: VAT category/rate pills
      (`components/invoices/LineItemEditor.tsx`), payment-method/currency/
      deadline pills (`app/(app)/invoices/new.tsx`), and filter pills
      (`app/(app)/invoices/index.tsx`) — establish a shared "choice pill"
      component with a minimum 44px height instead of ad hoc
      Pressable+className (2026-09-14 audit, ux-mobile)
      **Shipped** by item 8 above. The file references here were stale by
      the time this shipped: the composer rewrite had already replaced
      `LineItemEditor.tsx` (dead code, still not deleted — see item 8's
      follow-up note) with `composer/VatCategoryPicker.tsx`, and
      `app/(app)/invoices/new.tsx` with the `composer/StepPartner.tsx`
      pills — both now render through the new `ChoicePill` primitive
      (`components/ui/choice-pill/`), as does the extracted
      `InvoiceFilterChips.tsx`.
- [x] "Load demo data" empty-state CTA (`app/(app)/invoices/index.tsx`)
      routes unconditionally to Settings, but the demo-seed control there
      is hidden unless `EXPO_PUBLIC_ALLOW_DEV_SEED` is set (default off) —
      hide the CTA when the flag is off, or route straight to the seed
      control when it's on (2026-09-14 audit, ux-desktop)
      **Shipped 2026-09-15** by the app UX overhaul (item 8 above): the
      empty-state action now goes straight to `routes.newInvoice`
      (`t("nav.newInvoice")`, "Új számla") instead of Settings, so the
      demo-seed-visibility problem no longer applies.
- [x] A partially-paid invoice past its due date never surfaces as
      overdue in its own status — `deriveInvoiceStatusFromPayment`
      (`lib/invoices/payment-status.ts`) only compares against `dueDate`
      in the `paidAmount <= 0` branch; once partially paid it
      unconditionally returns "partially_paid" regardless of due date.
      Introduce a combined status or an additional overdue flag the UI can
      badge; add a test for paidAmount between 0 and total with a past due
      date. (2026-09-14 audit, feature)
      **Shipped 2026-09-15** on `slice/dashboard-overdue-partially-paid`.
      Left `deriveInvoiceStatusFromPayment` itself unchanged — its job is
      to pick the status to *persist* at the moment of a mark-paid action,
      and `lib/reminders/process.ts` (the cron that later flips a stale
      invoice to "overdue") **deliberately** never touches a
      `partially_paid` row, specifically to avoid discarding the
      partial-payment signal (see that file's own comment) — adding a new
      persisted status/enum value would mean a `db/schema.ts` change,
      which this repo's rules keep out of an auto-merged slice. Instead
      found and fixed the actual observable impact: `lib/dashboard/
      summary.ts`'s `overdueTotal`/`overdueCount`/`oldestOverdueDays`
      (both the pure `computeDashboardSummary` and the SQL-backed
      `getDashboardSummaryFromDb`) filtered strictly on
      `status === "overdue"`, so a partially-paid invoice past due
      permanently disappeared from the dashboard's overdue widget even
      though it genuinely is overdue money — undercounting, not just a
      cosmetic label gap. Added `isDashboardOverdue()`, which re-derives
      "overdue" from the due date for the `partially_paid` case only
      (reusing `isOverdue()` from `lib/invoices/status-visuals.ts`, the
      same derivation the invoice detail screen already uses for display,
      D3) while leaving `status === "sent"`/`"unpaid"` behavior exactly as
      it was — narrowly scoped to the one case the cron permanently skips,
      not a broader change to when a not-yet-cron-flipped invoice counts
      as overdue. The SQL path's grouped-by-status query can't see due
      dates per row, so the previous "which invoices are overdue"
      subquery (used for `oldestOverdueDays`) was extended to also pull
      partially-paid rows whose due date has passed and to sum their
      gross amount, replacing the status-only `overdueTotal` from the
      grouped fold. New tests in `lib/dashboard/summary.test.ts` cover a
      partially-paid-and-overdue invoice contributing to all three
      overdue fields while a partially-paid-not-yet-due invoice does not,
      and that `outstanding` is unaffected either way. `npm run
      typecheck` and `npm run test:unit` green (197 suites / 1113 tests).
- [~] needs sign-off (PR) (slice/e-nyugta-nav-receipt-api)
      e-nyugta (nyugtaadat-szolgáltatás) client targets an endpoint and
      schema that do not exist — `lib/nav-receipt/environment.ts` posts to
      `https://api-test.onlineszamla.nav.gov.hu/receipt-if/v1` with
      `schemas.nav.gov.hu/receipt/1.0/*` namespaces invented in
      `xml-builder.ts`. NAV published the real machine interface on
      2026-08-27 (`nav-gov-hu/eRECEIPT`: spec
      `docs/specification/NAV_Nyugta_adatszolgaltatas_IF_specifikacio_v1.2.pdf`,
      schema `xsd/1.1/receipt_datareport/receipt-if-schema-v1.1.xsd`, test
      base `https://bv-receipt-if.enyugta.nav.gov.hu/v1/`). Rebuild token
      exchange, request signature and the report XML against that XSD, test
      environment only. Electronic receipt data reporting has been mandatory
      since 2026-09-01 and NAV only waives penalties through the end of
      2026, so this is a real launch blocker for any EV issuing nyugta.
      (needs tax/legal sign-off)
      Plan (slice 1 of 3): `docs/plans/2026-09-18-e-nyugta-nav-receipt-api.md`
      (supersedes `docs/plans/2026-09-16-e-nyugta-nav-receipt-api.md`, which
      was planned but never built — the slice branch is still at `main`.)
      Planning fetched the real sources on 2026-09-16 and corrected three
      premises of this entry: (a) the published latest is now spec **v1.3**
      and XSD **1.1.1** (1.1.1 only widens `ReceiptSerialNumberType`, the
      request structure is unchanged); (b) the real namespace is
      `http://schemas.nav.gov.hu/NTCA/1.0/receipt` over
      `nav-gov-hu/Common` tag `common-2.0.0-rc.2`, and the operations are
      `POST /auth/token` + `POST /receipt/create` (JWT `Authorization:
      Bearer`), not a "token exchange" + `createReceiptDataReport`; (c) the
      `requestSignature` formula is **identical** to the OSA one already
      implemented in `lib/nav/crypto.ts`
      (SHA3-512(requestId + yyyyMMddHHmmss UTC + signKey), uppercase) — the
      spec's own worked example was verified to reproduce byte-for-byte and
      becomes a test fixture. The biggest correctness gap the entry does not
      name: NAV wants **gross totals per ÁFA *category name*** (`0%`, `5%`,
      `18%`, `27%`, `Alanyi adómentes`, `Egyéb` from `/vat-category/list`),
      not the net/VAT/gross triple the current builder sends — so an **AAM
      EV** must report under `Alanyi adómentes`, and a day mixing HUF and
      EUR receipts needs **one report per currency**. Slice 1 covers auth +
      `/receipt/create` + the payload rebuild; `/receipt/list`+`/detail`
      (slice 2) and `/receipt/modify`+`/invalidate` for storno nyugta
      (slice 3) stay open.
      Re-planning on 2026-09-18 downloaded and read
      `receipt-if-schema-v1.1.1.xsd` plus the `common-2.0.0-rc.2`
      `service`/`authservice`/`type`/`customer` schemas, confirmed the
      `CreateReceiptRequest` child sequence and the gross-per-category
      payload, and found three further traps: (a) `AuthTokenRequest` uses
      `LegacyContextType`, whose `requestId` is `[+a-zA-Z0-9_]{1,30}` — a
      `randomUUID()` is **invalid** there, while business requests do
      require a UUID; (b) `taxPayerId` is the **8-digit törzsszám**
      (`[0-9]{8}`), not the full `12345678-1-42` tax number; (c)
      `exchangeRate` is required-but-nillable and bounded `1..1000`, and
      `receipt` has no rate column at all — so slice 1 reports HUF days with
      `xsi:nil` and **refuses** non-HUF days rather than inventing a rate.
      The VAT **category names** are not in the XSD (only a pattern), so they
      stay an unverified constant with a sourced TODO until the tax/legal
      sign-off checks them against spec §5.9 / `/vat-category/list`.
      Follow-up item this slice files: additive `receipt.exchangeRate`
      (numeric, nullable) — it is what unblocks non-HUF nyugta reporting.
      **PR opened 2026-09-18** (`slice/e-nyugta-nav-receipt-api`, commit
      `484cc85`, includes a fix-round pass correcting a currency-group
      mixup on the receipt detail screen) — not merged, pending tax/legal
      sign-off per §8's OQ-1…OQ-6; `npx tsc --noEmit` and `npm run
      test:unit` (207 suites / 1254 tests) are green on the branch. 2
      low-severity follow-ups filed below (acceptance/ux dimensions), none
      blocking.
- [ ] **Ship-review follow-up (low, `slice/e-nyugta-nav-receipt-api`,
      2026-09-18)** — `receipts.navMissingExchangeRate` is defined in both
      `lib/i18n/locales/hu.ts:555` and `en.ts:555` but referenced nowhere
      else in the repo. The message actually shown for a blocked non-HUF
      receipt group comes from `BLOCKED_MESSAGE_HU`, a raw Hungarian string
      literal duplicated identically in
      `app/api/receipts/[id]/submit-nav+api.ts:20-21` and
      `app/api/cron/nav-receipt-report+api.ts:16-17`, written into
      `navReceiptSubmission.errorMessage` and rendered as-is (no `t()`
      call) in `app/(app)/receipts/[id]/index.tsx:201`. An English-locale
      user sees the raw Hungarian sentence instead of the English
      translation already sitting unused in `en.ts`. Fix: store the stable
      reason code (`BlockedReceiptGroup.reason` already provides
      `"missing_exchange_rate"`) in `errorMessage` instead of a
      pre-rendered sentence, and render it client-side via
      `t("receipts.navMissingExchangeRate")`, deleting the duplicated
      literal from both API route files.
- [ ] **Ship-review follow-up (low, `slice/e-nyugta-nav-receipt-api`,
      2026-09-18)** — the new NAV-report-id row in
      `app/(app)/receipts/[id]/index.tsx` repeats a pre-existing
      `selectable` prop console error on web ("Received `true` for a
      non-boolean attribute"), matching the unchanged `qrUrl` text a few
      lines below it in the same file. Not a new regression — out of scope
      for this PR — but worth a follow-up to replace `selectable` on web
      Gluestack `Text` with the web-safe equivalent (or gate it behind
      `Platform.OS !== 'web'`) across both occurrences in this file.
- [~] folyamatban (slice/non-huf-invoice-exchange-rate-nav-xml)
      Non-HUF invoices report a false HUF VAT base to NAV — confirmed
      resolved: `lib/nav/invoice-xml.ts` now emits the real
      `<exchangeRate>` (and every `…HUF` element) from `invoice.exchangeRate`
      instead of hardcoding `1`, refuses to submit a non-HUF invoice with no
      usable rate, and the PDF/preview show the rate used and the HUF VAT
      amount. (needs tax/legal sign-off — which rate and which date govern
      the HUF VAT amount is an Áfa tv. question, not a code choice)
      Same item as priority #3 above. Plan:
      `docs/plans/2026-09-15-non-huf-invoice-exchange-rate-nav-xml.md`
      Planning also found two write-path leaks the item's text did not
      name, both in scope of that plan: `POST /api/invoices` never copies
      `body.exchangeRate` (so the composer's rate is dropped on every newly
      created invoice — `PATCH` keeps it, which is why the field looks like
      it works when editing), and `lib/invoices/create-from-payload.ts`
      (`POST /api/v1/invoices`) has no `exchangeRate` field at all. See
      priority #3's note above for implementation status (2026-09-15).
- [x] Shipped 2026-09-15 (slice/nav-xml-payment-method-date)
      Payment method never reaches the NAV XML —
      `lib/nav/invoice-xml.ts` defers it as "schema placement not
      verified", but `invoiceDetail` in the published `invoiceData.xsd`
      carries `paymentMethod` and the column already exists
      (`invoice.paymentMethod`). Map transfer/cash/card/other to the XSD's
      own enum, verified by fetching the schema rather than
      guessing, with a fixture test like the `invoiceReference` work.
      (needs tax/legal sign-off)
      Same item as priority #4 above. Plan:
      `docs/plans/2026-09-15-nav-xml-payment-method-date.md`
      Correction found while planning (schema fetched 2026-09-15): the
      `paidAt` half of this item's title is a false premise.
      `invoiceDetail/paymentDate` is documented in the XSD as "Fizetési
      határidő" / "Deadline for payment", and the builder already emits
      `invoice.dueDate` there — correctly. `InvoiceDetailType`,
      `ConventionalInvoiceInfoType` and `AdditionalDataType` contain no
      actual-payment-date element, so `invoice.paidAt` stays out of the
      XML rather than being smuggled into `additionalInvoiceData`. The
      slice instead adds `paymentMethod` and normalizes the emitted dates
      to `InvoiceDateType` shape (date-only, ≥ 2010-01-01), which the
      current raw pass-through of a `text` due date does not guarantee.
      Implemented: `lib/nav/invoice-fields.ts` (new: `toNavPaymentMethod`,
      `toNavDate`) + `lib/nav/invoice-xml.ts`; AC1-15 in the plan all green,
      `npx tsc --noEmit` clean, `npm run test:unit` green. This is
      tax/legal-gated (mandatory NAV data-report content) and shipped as a
      PR for human sign-off per CLAUDE.md, with OQ-1…OQ-5 in the PR body.
      **Shipped 2026-09-15. Reviewed and merged 2026-09-15 (owner sign-off)**
      together with priority #3's exchange-rate slice — the merged
      `<invoiceDetail>` emits `currencyCode`, `exchangeRate`,
      `paymentMethod`, `paymentDate` in that verified schema order, so both
      slices' NAV XML changes are present with none silently dropped.
- [~] folyamatban (slice/dijbekero-convert-to-invoice)
      Díjbekérő (proforma) is a dead end — `lib/invoices/numbering.ts` mints
      DBK-/ELO- numbers and `lib/i18n/locales/hu.ts` labels them, but there
      is no way to turn a paid díjbekérő into the actual számla: nothing in
      `app/(app)/invoices/[id]/index.tsx`, `lib/invoices/service.ts` or
      `app/api/invoices/[id]/duplicate+api.ts` converts one document type
      into the next. Add a "convert to invoice" action that copies lines and
      client data into a new INV document and links the two, which is the
      standard collect-then-invoice flow every Hungarian competitor ships
      and the reason an EV issues a díjbekérő at all.
      Same item as priority #5 above. Plan:
      `docs/plans/2026-09-15-dijbekero-convert-to-invoice.md`
      Planning also confirmed two adjacent bugs the item's text did not
      mention, both fixed in this slice because the new flow makes them
      reachable: "Sztornó" and "Helyesbítő számla" are currently offered on a
      díjbekérő, and both mint a real `INV-` number out of the *invoice*
      sequence (`sequenceBucketForDocType` maps storno/modify to the
      `invoice` bucket) for a cancellation of a document that was never a
      számla — a hole in the continuous invoice numbering. Also confirmed
      *not* a problem: a díjbekérő is never auto-submitted to NAV
      (`useInvoiceComposer` only submits on `status === "sent"`), and the
      converted document is a plain draft, so it reaches NAV only through
      the existing explicit composer toggle. Risk: **schema** (one additive
      nullable `invoice.converted_from_invoice_id` column + index) — not
      tax/legal-gated; the díjbekérő document disclaimer ("nem számla, áfa
      levonására nem jogosít") is deliberately left out of this slice as a
      separate, sign-off-gated follow-up.
      **PR opened 2026-09-15** (`slice/dijbekero-convert-to-invoice-impl`,
      includes a fix-round-1 pass surfacing convert/storno/modify error
      codes and fixing mobile convert access) — not merged, pending review
      sign-off; 5 low-severity follow-ups filed above (acceptance/ux
      dimensions), none blocking.
      **PR merged 2026-09-15.** Fix-round-2
      (`slice/dijbekero-proforma-to-invoice-flow`, 2026-09-18) closed F1-F4
      above (double-conversion race, missing links-card test, the
      redundant `runAction`, and cancelled-vs-live link rendering) and
      added the one remaining real EV value: a converted díjbekérő now
      shows "Számlázva" and an "open existing" menu action in both the
      desktop table and the mobile card list instead of looking identical
      to an unconverted one. `npx tsc --noEmit` clean, `npm run test:unit`
      green (1237 tests). Still `[~]`, not `[x]`: the díjbekérő document
      disclaimer text ("nem számla, áfa levonására nem jogosít") stays
      deliberately out of scope, sign-off-gated, as recorded above and in
      the fix-round-2 plan §9 — that is the one piece left before this
      whole item can close.

- [~] folyamatban (slice/hungarianize-brand-invoice-preview-pdf)
      Invoice document preview/PDF remains English and unbranded
      (`lib/invoices/preview-html.ts`) — confirmed still live: both the
      new composer's sticky mini-preview and the finalized invoice
      detail's "Előnézet" render "DRAFT", "Status: unpaid", "Bill to:",
      "Description/Qty/Unit/VAT/Total" in English with no InvoHub
      branding. Already explicitly out of scope for the 2026-09-14 app
      UX/UI overhaul (spec §8), but the composer redesign now puts this
      preview in a permanent sidebar on every invoice screen instead of a
      separate preview tab, so it's more visible than before — prioritize
      this as the next queue item. (2026-09-15 audit, ux-desktop)
      Same item as priority #2 above. Plan:
      `docs/plans/2026-09-15-hungarianize-brand-invoice-preview-pdf.md`
      See priority #2's note above for implementation status (2026-09-15).
- [ ] Invoice PDFs cannot render `ő` and `ű` — `lib/invoices/pdf-document.ts`
      uses pdfkit's standard Helvetica (WinAnsi/cp1252), which has no glyph
      for U+0151 / U+0171; pdfkit emits them as raw two-byte codes, so a
      partner named "Kőfaragó Kft." or a line "Tetőfelújítás" is already
      garbage in every PDF the app emails today (verified against the repo's
      own pdfkit, 2026-09-15). The preview/branding slice above only adds an
      interim `toWinAnsiSafe()` transliteration (ő→ö, ű→ü) so the text is at
      least legible. The real fix: embed a Latin-Extended-A TTF (regular +
      bold, licence checked — no embeddable font exists in the repo or in
      `node_modules` today), load it in `createPdfDocument`, and extend
      `assets/pdfkit-data` + `scripts/prepare-server-pdf-deps.mjs` +
      `vercel.json` `includeFiles` + `scripts/verify-pdf-vendor.mjs` so it
      survives the Vercel bundle; then delete the transliteration and its
      test. (2026-09-15 planning, feature)
- [ ] Ranade weight 500 is defined (`global.css`, `@font-face`,
      `public/fonts/ranade-500.woff2`) but never actually requested by any
      heading — every `font-heading` usage is paired with
      `font-bold`/`font-semibold`, and `components/ui/heading/styles.tsx`
      bakes `font-bold` into the shared `Heading` base style, so no
      rendered heading can ever hit weight 500. The app UX spec's AC4
      (`docs/design/app-ux-spec-2026-09-14.md:1250`,
      `document.fonts.check('500 16px Ranade') === true`) is therefore
      unimplemented and unsatisfiable as written — no e2e spec checks it
      either (`grep -rl "Ranade\|fonts.check" e2e/` is empty). Not a
      visible UI defect (Ranade 700, the weight every heading actually
      uses, loads and renders correctly) — this is a spec/test-authoring
      gap, not a regression. Either rewrite AC4 to check weight 700, or
      apply `font-medium` somewhere in the heading scale and add the
      missing e2e check. (2026-09-15 audit, acceptance)
- [ ] Composer line-item row still needs horizontal scrolling within
      itself at 1440px to show every column beside the fixed 400px
      summary panel (~680px available vs. ~1068px needed for the spec's
      full 8-column layout, including the description field's 240px
      minimum). Fixing this fully needs a larger redesign — e.g. reworking
      the summary panel width, or restructuring the row itself (merging
      Nettó/Bruttó into one figure) — beyond a narrow round-2 fix.
      (2026-09-15 audit, ux-desktop)
- [ ] `components/notifications/NotificationPanel.tsx` has substantial
      pre-existing hardcoded English chrome text ("Notifications", "Mark
      all read", "Refresh", empty-state copy, "Just now"/"Xh ago") — left
      untouched by the 2026-09-15 i18n fix that only covered generated
      notification *content*, not the panel's own chrome. (2026-09-15
      audit, i18n)
- [ ] Notification rows created before the 2026-09-15 i18n-key encoding
      fix (in the same DB, from earlier test runs) still render as literal
      English text — by design, only newly-synced/newly-seeded
      notifications get the fix. Needs a data migration to backfill, not
      just a code change, if old rows must display correctly too.
      (2026-09-15 audit, i18n)
- [ ] AC3 of the hungarianize-brand-invoice-preview-pdf plan
      (`docs/plans/2026-09-15-hungarianize-brand-invoice-preview-pdf.md:109`)
      literally reads `formatDocumentAmount(1234.5, "EUR") === "1 234,56 €"`,
      which is a typo — 1234.5 rounded to 2 decimals is 1234,50, not ,56.
      `lib/invoices/document-labels.ts` correctly returns `"1 234,50 €"`
      (verified directly against `Intl.NumberFormat("hu-HU")`), and
      `lib/invoices/document-labels.test.ts:66-67` asserts the correct
      value — no code change needed, just fix the plan/AC's literal
      example for future reference. (2026-09-15 audit, acceptance)
- [ ] AC15 of the same plan lists literal `"Vevő"` / `"Fizetési
      határidő"` (containing ő) as required PDF `mockDrawnTexts` entries,
      which contradicts AC16 ("every mockDrawnTexts entry satisfies
      isWinAnsiSafe") since `isWinAnsiSafe`
      (`lib/invoices/document-labels.ts`) is false for any ő/ű-containing
      string. `lib/invoices/generate-pdf.ts` routes every drawn string,
      labels included, through `toWinAnsiSafe` (matching the plan's own
      stated intent), so the PDF draws `"Vevö"` / `"Fizetési határidö"`
      — the only self-consistent reading given AC16.
      `lib/invoices/generate-pdf.test.ts:157-183` asserts the
      transliterated form with an inline comment explaining why. No code
      change needed; update AC15's literal text once the real PDF font
      item (embedding a Unicode font) lands and the transliteration is
      removed. (2026-09-15 audit, acceptance)
- [x] `lib/invoices/preview-html.ts` interpolates the PDF template's
      `accentColor` straight into a `<style>` block
      (`--cornflower: ${escapeHtml(accent)}`) without ever calling
      `normalizeHexColor` — `escapeHtml` only escapes `& < > " '`, not
      `; } / *` or whitespace, so it cannot stop CSS-syntax injection.
      `normalizeHexColor` (`lib/invoices/pdf-template/defaults.ts`) is
      only invoked on the write path (`lib/invoices/pdf-template/
      service.ts`'s `upsertPdfTemplate`) — the read path
      (`getPdfTemplate`/`mapRow`) returns the DB value unchanged, so the
      render path's safety depends entirely on the write path always
      being the only source of this value. Call `normalizeHexColor(accent)`
      before interpolating it (in `preview-html.ts` and/or in `mapRow` at
      read time). (2026-09-15 audit, security)
      **Fixed 2026-09-15** on `slice/pdf-template-color-sanitize` — did
      both suggested spots, not just one: `preview-html.ts`'s `accent`
      value now goes through `normalizeHexColor` before interpolation
      (closing the actual injection point), and `pdf-template/
      service.ts`'s `mapRow` now normalizes `row.accentColor` on every
      read too, so the render path's safety no longer depends on every
      past and future write path having validated the value (a legacy
      row, a direct DB edit). `lib/invoices/generate-pdf.ts`'s own
      `template.accentColor` use (pdfkit `fillColor`, not string
      interpolation into markup) was checked and isn't independently
      vulnerable, and is now covered transitively too since it reads the
      same `getPdfTemplate()`-sourced value. New tests: `preview-html.
      test.ts` asserts a malicious `accentColor` value never reaches the
      rendered `<style>` block; `pdf-template/service.test.ts` asserts
      `getPdfTemplate` normalizes a malformed value read back from the
      DB. `npm run typecheck` and `npm run test:unit` green (197 suites /
      1115 tests).
- [x] `focusField: "exchangeRate"` (set on a failed save by
      `composer-logic.ts`'s `validateExchangeRateInput`, applied via
      `setFocusField` in `useInvoiceComposer.ts`) is never consumed or
      cleared — `StepPartner.tsx` only has a ref/focus effect for
      `focusField === "clientName"` (`nameInputRef`), and the
      exchange-rate `Input` has no ref at all, so after a failed save due
      to a missing/invalid rate the state stays stuck at "exchangeRate"
      with no visible effect. Add a ref to the exchange-rate `Input` and
      extend `StepPartner`'s focus effect to also handle
      `focusField === "exchangeRate"`, focusing it and calling
      `clearFocusField()` the same way the clientName branch does.
      (2026-09-15 ship review of slice/non-huf-invoice-exchange-rate-nav-xml,
      acceptance)
      **Fixed 2026-09-15** on `slice/composer-exchange-rate-focus`. Also
      found and handled a wrinkle the item's text didn't call out: the
      exchange-rate field lives inside the "Dates/Payment" section, which
      is **collapsed by default** (`showDatesPayment`) — a naive
      copy-paste of the clientName branch would call `.focus()` on a ref
      to an unmounted input and silently do nothing. The effect now
      expands that section first when `focusField === "exchangeRate"` and
      `!showDatesPayment`, lets the re-render mount the field (the effect
      re-runs on the `showDatesPayment` dependency), then focuses it and
      calls `clearFocusField()`. The ref itself uses the same `as never`
      cast `PartnerPicker.tsx` already uses for its own `inputRef` —
      Gluestack's `InputField` forwards a ref typed against its own props
      instead of the underlying `TextInput` instance. New
      `StepPartner.test.tsx` drives `focusField` through real React state
      (mirroring how `useInvoiceComposer` owns it) and asserts the section
      auto-expands, the input receives focus, and the sequence isn't a
      one-shot — verified the test actually catches the bug by confirming
      it fails against the pre-fix code. `npm run typecheck` and `npm run
      test:unit` green (198 suites / 1116 tests).
- [ ] The new exchange-rate `Input` and currency pills in
      `StepPartner.tsx` are ~34px tall on mobile, below the 44px
      tap-target guideline — matches the sizing every other composer
      `Input` already uses, and the currency-selector tap-target work is
      already filed separately (see item 8 above); listed here only so
      the exchange-rate field isn't missed when that item is picked up.
      (2026-09-15 ship review of slice/non-huf-invoice-exchange-rate-nav-xml,
      ux)
- [x] The new `invoices.document.exchangeRate` /
      `exchangeRateValue` / `vatInHuf` i18n keys
      (`lib/i18n/locales/en.ts`, `hu.ts`) were unused by
      `lib/invoices/preview-html.ts` / `generate-pdf.ts` at ship time — **by
      design**, not a bug: those renderers were still the pre-branding,
      all-English versions (`slice/hungarianize-brand-invoice-preview-pdf`
      had not landed on `main` yet), and the plan's own rebase note
      (`docs/plans/2026-09-15-non-huf-invoice-exchange-rate-nav-xml.md`,
      "Rebase note") directed using `formatCurrency` + hardcoded English to
      match the file's then-current state, with the new keys wired in once
      this slice was rebased onto the landed branding slice.
      **Resolved 2026-09-15**: wired in while merging this slice with the
      landed branding slice — both `document.exchangeRate` /
      `exchangeRateValue` and `document.vatInHuf` are now read by
      `preview-html.ts`'s exchange-rate note and `generate-pdf.ts`'s forint
      VAT line. Also fixed a duplicate `document:` object-literal key this
      merge would otherwise have introduced in `hu.ts`/`en.ts` (the
      branding slice and this slice each added their own `invoices.
      document` block at a different point in the file).
- [x] Check-then-act race lets the same díjbekérő be converted twice
      despite the 409 guard — `convert+api.ts` calls
      `findExistingConversion(...)` then, only if null,
      `convertProformaToInvoice(...)`: two sequential DB calls with no
      transaction. `drizzle/0002_dijbekero-convert-to-invoice.sql` adds
      only a plain btree index and an FK, no unique constraint, so two
      near-simultaneous POSTs (double-click, two tabs) can both pass the
      check and both insert. Mirrors an existing accepted risk pattern
      already in the codebase (`storno+api.ts` has the identical
      check-then-act shape with no transaction), and the result is only
      an extra draft, not a burned invoice number (per AC8) — annoying,
      not a compliance/financial-integrity break. Fix: wrap check+create
      in a transaction, or add a partial unique index on
      `(user_id, converted_from_invoice_id) WHERE status <> 'cancelled'`
      and catch the violation as the 409 path — consistent with fixing
      the same latent gap in storno.
      (2026-09-15 ship review of slice/dijbekero-convert-to-invoice-impl,
      acceptance)
      **Resolved 2026-09-18** (`slice/dijbekero-proforma-to-invoice-flow`):
      added the partial unique index
      `invoice_converted_from_live_unique_idx` on
      `(user_id, converted_from_invoice_id) WHERE converted_from_invoice_id
      IS NOT NULL AND status <> 'cancelled'` (`drizzle/0003_dijbekero-
      double-conversion-guard.sql`, additive only — no DROP/ALTER/rename)
      as the DB-level backstop, a new pure `isUniqueViolation()` classifier
      (`lib/db/unique-violation.ts`), and a try/catch in `convert+api.ts`
      that, on the violation, re-runs `findExistingConversion` and returns
      the identical 409 `{ code: "alreadyConverted", invoice }` — or
      rethrows if the winner is no longer live. A route test fakes the
      `23505` race and asserts a 409, never a 500. The identical race in
      `storno+api.ts` is still open — separate item, not touched here.
- [x] AC20 (the "Kapcsolódó bizonylatok" card renders
      `convertedTo`/`convertedFrom` and navigates) has no automated test
      covering the rendered links or a click-through, and the plan's
      required manual-verification note (§5.4: "verifying the screens by
      hand at both breakpoints (§9). Note the manual check results in the
      PR body.") is missing from the shipped commit.
      `__tests__/screens/invoice-detail.test.tsx`'s AC17-19 cases all pass
      `convertedFromInvoice: null`, and only one case (AC18) populates
      `convertedToInvoices`, but even that only asserts the primary
      button's label/onPress, never the links card's rendered
      `t("invoices.links.convertedFrom"/"convertedTo")` text
      (`app/(app)/invoices/[id]/index.tsx` ~430-443) or navigation through
      those rows. Fix: add a test case with a populated
      `convertedFromInvoice` and a `convertedToInvoices` entry, asserting
      the rendered link text and onPress navigation both directions; or,
      if kept manual, record the by-hand verification (both breakpoints)
      in the PR body as the plan requires.
      (2026-09-15 ship review of slice/dijbekero-convert-to-invoice-impl,
      acceptance)
      **Resolved 2026-09-18** (`slice/dijbekero-proforma-to-invoice-flow`):
      `__tests__/screens/invoice-detail.test.tsx` gained a case with a
      populated `convertedFromInvoice` asserting the rendered
      `invoices.links.convertedFrom` row and that pressing it navigates via
      `router.push` to the source díjbekérő's detail route, plus a case
      with two `convertedToInvoices` (one live, one cancelled) asserting
      both rows render with their distinct i18n keys and pressing the live
      row navigates to it.
- [x] Redundant nested `runAction("convert", ...)` on the primary convert
      button in `app/(app)/invoices/[id]/index.tsx`: `primaryOnPress`
      wraps `handleConvert` in `runAction("convert", ...)`, but
      `handleConvert` itself already calls `runAction("convert", ...)`
      internally — double `setBusy`/`setMessage`/try-catch. Every other
      self-wrapping handler on this screen (`handleDelete`,
      `handleStorno`, `handleCorrection`, `handleMarkPaid`,
      `handlePaymentLink`) is invoked bare from its `onPress`, and every
      externally-wrapped one (`handleSend`, `handleDuplicate`,
      `handleDownloadPdf`) has no internal `runAction` — `handleConvert`
      is the only handler doing both. Fix: call `() => void
      handleConvert()` directly instead of re-wrapping it.
      (2026-09-15 ship review of slice/dijbekero-convert-to-invoice-impl,
      acceptance)
      **Resolved 2026-09-18** (`slice/dijbekero-proforma-to-invoice-flow`):
      `primaryOnPress` now calls `() => void handleConvert()` directly;
      `runAction("convert", ...)` appears exactly once in the file, inside
      `handleConvert` itself — matching every other self-wrapping handler
      on the screen.
- [x] "Kapcsolódó bizonylatok" renders a cancelled prior conversion
      identically to a live one —
      `app/api/invoices/[id]/links+api.ts`'s
      `findInvoicesReferencing(userId, "convertedFromInvoiceId", id)`
      applies no status filter, and
      `app/(app)/invoices/[id]/index.tsx` (~437-443) renders every result
      with the same `invoices.links.convertedTo` text and no status chip,
      even though `liveConversion` elsewhere in the same file already
      distinguishes `status !== "cancelled"`. After a stornó-then-reconvert
      cycle this shows two visually identical link rows. Fix: filter
      cancelled entries out of the rendered list, or attach a status
      indicator per row.
      (2026-09-15 ship review of slice/dijbekero-convert-to-invoice-impl,
      ux)
      **Resolved 2026-09-18** (`slice/dijbekero-proforma-to-invoice-flow`):
      kept every row (no filtering, so the history stays visible) but
      distinguished them textually — a `status === "cancelled"` row now
      renders `invoices.links.convertedToCancelled` ("...(sztornózva):
      {{number}}" / "...(cancelled): {{number}}") instead of the plain
      `invoices.links.convertedTo`, per the plan's UX note to use copy, not
      a new colour, in this plain-list card.
- [ ] `docs/loop-queue.md`'s fix-round-2 note (above, "folyamatban
      (slice/dijbekero-convert-to-invoice)") says "**PR merged 2026-09-15.**
      Fix-round-2 (`slice/dijbekero-proforma-to-invoice-flow`, 2026-09-18)
      closed F1-F4 ..." — claiming the PR merged on 2026-09-15, three days
      *before* the 2026-09-18 fix-round-2 work it goes on to describe, and
      this branch is in fact still unmerged/under review as of 2026-09-18.
      Fix: reword to something like "**PR opened 2026-09-18, pending
      review.** Fix-round-2 ... closed F1-F4 ..." and let the Ship phase
      add the actual merge note once it merges, consistent with CLAUDE.md's
      rule that Ship (not the implementer) records merges.
      (2026-09-18 ship review of slice/dijbekero-proforma-to-invoice-flow,
      acceptance)
- [ ] AC14's screen-level wiring (`menuItemsFor`/`handleOpenExisting` swap
      in `app/(app)/invoices/index.tsx`) has no dedicated test with a
      non-empty `convertedProformaIds` map — the only test touching that
      screen (`__tests__/screens/app-pages.smoke.test.tsx`) adds
      `convertedProformaIds: {}` to the `useInvoices` mock and only asserts
      the screen renders. The label swap
      (`invoice.documentType === "proforma" && convertedProformaIds[invoice.id]`
      → `invoices.convert.openExisting`) and `handleOpenExisting`'s id
      lookup → `router.push(routes.invoiceDetail(existingId))` are manually
      verified correct by reading the code, but are exercised only through
      `InvoiceCard.test.tsx`/`InvoiceListTable.test.tsx` with hand-supplied
      props, never through this screen's own id-mapping logic with a
      populated map. Fix: add a case to `app-pages.smoke.test.tsx` (or a new
      screen test) mocking `useInvoices` with a non-empty
      `convertedProformaIds` map, asserting the swapped label and correct
      navigation target.
      (2026-09-18 ship review of slice/dijbekero-proforma-to-invoice-flow,
      ux)
- [ ] `InvoiceListRow`'s converted badge (`components/invoices/InvoiceListRow.tsx`
      ~56-65) is not gated on `documentType`, unlike `InvoiceCard.tsx`
      (~106: `invoice.documentType === "proforma" && converted`) — it
      renders whenever the `converted` prop is true, with no proforma
      check. Currently safe only because the sole caller
      (`invoices/index.tsx`'s `convertedProformaIds`, built exclusively from
      proforma rows per AC11/AC12) guarantees `converted` is never true for
      a non-proforma row — an implicit, untested invariant at this
      component's own boundary; `InvoiceListRow.test.tsx`'s AC17 negative
      case uses `documentType: "proforma"` with `converted` omitted, not a
      non-proforma row with `converted=true`. Fix: either add the same
      `documentType` guard inside `InvoiceListRow` for defense-in-depth, or
      add a test asserting a non-proforma invoice with `converted=true`
      does not render the badge.
      (2026-09-18 ship review of slice/dijbekero-proforma-to-invoice-flow,
      ux)
- [ ] The branch this shipped from was 2 commits stale behind `main`
      (missing the desktop sidebar collapse redesign,
      `components/navigation/AppSidebar.tsx`) at review time — cosmetic
      only, since the slice branch never touched that file, so a normal
      merge/rebase onto `main` resolves cleanly with no conflict; only a
      careless manual overwrite would regress it. No action needed beyond
      the normal rebase-before-merge habit.
      (2026-09-15 ship review of slice/dijbekero-convert-to-invoice-impl,
      ux)
- [ ] Branch was cut from a stale `main` (2 commits behind), not the current
      tip — verified directly: `git merge-base main
      slice/pdf-invohub-brand-mark` == `958bd89` while `main`'s tip was
      `7f82812`, two commits ahead (`7403879` "Plan:
      pdf-invohub-brand-mark", `7f82812` "Replace app icon/favicon..."). The
      three-dot diff against the merge-base matches the 12 plan-listed files
      exactly; the noisy two-dot `main..slice` diff (6 icon PNGs,
      `LandingSections.tsx`, a deleted plan doc) is purely a stale-base
      artifact. `git merge-tree <merge-base> main slice` produced zero
      conflict markers, so a normal merge/rebase applies cleanly and won't
      revert the icon or plan-doc commits. No code fix needed — Ship should
      `git fetch`/rebase or merge normally rather than trusting a raw
      `main..slice` diff at face value.
      (2026-09-16 ship review of slice/pdf-invohub-brand-mark, acceptance)
- [ ] Footer attribution text stays at pre-existing low contrast (~3.17:1)
      after gaining the mark — `lib/invoices/preview-html.ts`'s `.footer`
      rule keeps `color: #8a90a6; font-size: 0.78rem` unchanged by this
      slice (only `display:flex`/alignment/gap and a `.footer svg{flex-
      shrink:0}` rule were added, plus inserting `brandMarkSvg({size:20})`
      before the label span). Computed contrast of `#8a90a6` on white ≈
      3.17:1, below WCAG AA's 4.5:1 for normal-size text (12.48px doesn't
      meet the "large text" threshold). Confirmed visually in
      `docs/audits/loop/2026-09-16-pdf-invohub-brand-mark/screens/
      desktop-ux-preview-with-company-footer.png` — the mark's own navy/
      cornflower inks are high-contrast on their own, only the accompanying
      text is dim. Optional polish, not a blocker: on a future touch of this
      file, darken `.footer` text color (e.g. toward `#6b7280`/`#5b6178`).
      (2026-09-16 ship review of slice/pdf-invohub-brand-mark, ux)

## Phase 2 — Bank data connection & paid/unpaid matching

CSV / camt.053 import ships **before** any live bank/PSD2 connection.
Never auto-finalize an uncertain match — only exact, unambiguous matches
may auto-confirm.

- [x] Pure match candidate scoring (amount / remittance / name / date; no
      auto-finalize unless exact) — `lib/bank-matching/`
- [ ] Bank statement import: CSV and camt.053 parsing (`lib/import/`)
- [ ] Matching engine wiring + human review UI for non-exact candidates
- [ ] PSD2 / live bank provider evaluation — only after CSV/camt.053 import
      has shipped and been used; needs its own security/provider review
      before any code is written against a real provider

## Phase 3 — EV tax calculator

Launch gate: Hungarian tax-professional validation against regression
fixtures. Never hardcode a tax figure nobody has sourced and verified.

- [ ] Tax rules versioning scaffolding — `lib/tax/rules/<year>.ts` per
      `.claude/skills/ev-tax-rules/SKILL.md` (sourced, dated, confidence-
      tagged figures; TODOs instead of guesses)
- [ ] Calculator UI with explainable output and the required "estimate,
      not tax advice" disclaimer in both `hu.ts` and `en.ts`
- [ ] Tax-professional validation of the rule files and regression
      fixtures — human sign-off, tracked here as its own checkbox, not
      assumed once the code exists

## Phase 4 — NAV M2M tax-return submission

Launch gate: threat model, load testing, NAV failure/recovery
verification, and legal review before any marketing copy claims InvoHub
replaces an accountant.

- [ ] M2M tax-return submission wiring beyond the current Adózó API
      exploration (`lib/m2m/`) — idempotent submission, signed webhooks,
      retry/dead-letter handling, audit logs
- [ ] Clarify and implement the power-of-attorney (meghatalmazás) flow
      required for InvoHub to submit on behalf of an EV — this is a legal
      prerequisite, not just an API credential
- [ ] Legal review of any copy claiming InvoHub replaces an accountant —
      required before that claim can appear anywhere, including marketing
