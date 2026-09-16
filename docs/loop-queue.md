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
- [ ] **Hungarian ő/ű render as ö/ü in the PDF** — e.g. "Vevő" → "Vevő" shows
  as "Vevö", "Fizetendő" → "Fizetendö". This is a *known, already-flagged*
  limitation: `lib/invoices/generate-pdf.ts`'s `doc.text` is wrapped to run
  every string through `toWinAnsiSafe` (see `document-labels.ts`) because
  pdfkit's built-in Helvetica AFM only has WinAnsi/cp1252 glyphs, which has
  no ő/ű — so it silently substitutes the wrong (but adjacent-looking)
  character. There's a `TODO(needs-human-review, PDF font item)` comment on
  that exact line already asking for a real embedded font. This ships
  Hungarian legal documents with misspelled Hungarian words — fix it
  properly: embed a Latin-Extended-A-complete TTF (e.g. an open-license
  Noto Sans / Inter static build — check `assets/fonts/` and licensing) via
  `doc.registerFont()`/`doc.font()` in `lib/invoices/pdf-document.ts` /
  `generate-pdf.ts`, verify Vercel serverless bundling the same way
  `assets/pdfkit-data` already is (`scripts/prepare-server-pdf-deps.mjs`,
  `scripts/verify-pdf-vendor.mjs`), and only then remove the
  `toWinAnsiSafe` substitution (or keep it as a last-resort fallback if the
  custom font ever fails to load — the render must never silently produce
  wrong Hungarian text).
- [ ] **No real InvoHub brand mark anywhere in the PDF** — only the issuing
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
- [ ] **Broken pagination wastes an entire page** — with the *default*
  template (short footer text "Köszönjük a bizalmat!", two line items,
  short notes), the PDF still spills onto a near-blank second page just to
  show that one footer line. Something in `contentBottom`/`ensureSpace`
  (`lib/invoices/pdf-layout.ts`) or the footer-placement logic in
  `generate-pdf.ts` (~line 336) is reserving/measuring space wrong. Fix so
  a normal 1-2 item invoice fits on one page.
- [ ] **General layout gap vs. the HTML preview** — the PDF's content area
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
5. Díjbekérő (proforma) → real flow: DBK number, "Számla készítése ebből"
   action that converts to a final invoice (`lib/invoices/numbering.ts`, detail screen)
6. [x] Partially-paid invoice past due date surfaces as overdue (status
   derivation) — **Shipped 2026-09-15** on
   `slice/dashboard-overdue-partially-paid`. See the matching detailed
   entry below (under "Remaining for the launch gate") for what was
   actually wrong and fixed.
7. e-nyugta: real NAV eRECEIPT API (nav-gov-hu/eRECEIPT spec v1.2 / XSD 1.1,
   test base https://bv-receipt-if.enyugta.nav.gov.hu/v1/) behind demo/test
   modes — big item, plan it in slices
8. Invoice-flow tap targets: inline pill buttons and the notification bell ≥44px
   — **partially shipped**: the composer's own line-item icon buttons are
   now 44px (`components/invoices/composer/LineItemRow.tsx`), but the
   notification bell (`components/navigation/MobileAppHeader.tsx`, ~42px)
   and several choice pills (VAT category picker, partner-type pills,
   invoice-list filter chips) are still under 44px — see the new findings
   below; item stays open.
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
- [ ] Notification bell tap target (`components/navigation/
      MobileAppHeader.tsx`) is ~42px, just under the 44px minimum — bump
      padding to p-3 or add hitSlop (2026-09-14 audit, ux-mobile)
- [ ] Multiple inline-choice pill buttons across the invoice flow are
      under the 44px tap-target minimum: VAT category/rate pills
      (`components/invoices/LineItemEditor.tsx`), payment-method/currency/
      deadline pills (`app/(app)/invoices/new.tsx`), and filter pills
      (`app/(app)/invoices/index.tsx`) — establish a shared "choice pill"
      component with a minimum 44px height instead of ad hoc
      Pressable+className (2026-09-14 audit, ux-mobile)
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
- [ ] e-nyugta (nyugtaadat-szolgáltatás) client targets an endpoint and
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
- [ ] Check-then-act race lets the same díjbekérő be converted twice
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
- [ ] AC20 (the "Kapcsolódó bizonylatok" card renders
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
- [ ] Redundant nested `runAction("convert", ...)` on the primary convert
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
- [ ] "Kapcsolódó bizonylatok" renders a cancelled prior conversion
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
- [ ] The branch this shipped from was 2 commits stale behind `main`
      (missing the desktop sidebar collapse redesign,
      `components/navigation/AppSidebar.tsx`) at review time — cosmetic
      only, since the slice branch never touched that file, so a normal
      merge/rebase onto `main` resolves cleanly with no conflict; only a
      careless manual overwrite would regress it. No action needed beyond
      the normal rebase-before-merge habit.
      (2026-09-15 ship review of slice/dijbekero-convert-to-invoice-impl,
      ux)

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
