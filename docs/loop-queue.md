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

1. Invoice creation flow: step/accordion flow on mobile, fewer fields before
   line items (`app/(app)/invoices/new.tsx`)
2. Non-HUF invoices: use `invoice.exchangeRate` for the HUF VAT base in the
   NAV XML and on the PDF (`lib/nav/invoice-xml.ts`, `lib/invoices/build-pdf-context.ts`)
3. Payment method + payment date into the NAV XML (`paymentMethod`, `paidAt`)
4. Díjbekérő (proforma) → real flow: DBK number, "Számla készítése ebből"
   action that converts to a final invoice (`lib/invoices/numbering.ts`, detail screen)
5. Partially-paid invoice past due date surfaces as overdue (status derivation)
6. e-nyugta: real NAV eRECEIPT API (nav-gov-hu/eRECEIPT spec v1.2 / XSD 1.1,
   test base https://bv-receipt-if.enyugta.nav.gov.hu/v1/) behind demo/test
   modes — big item, plan it in slices
7. Invoice-flow tap targets: inline pill buttons and the notification bell ≥44px
8. Invoices empty-state CTA: replace "Load demo data" with "Első számla
   kiállítása" (demo seed stays behind the dev flag)


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
- [~] folyamatban (slice/invoice-creation-step-flow-mobile)
      Invoice creation (`app/(app)/invoices/new.tsx`) is one long, flat
      scroll with ~16 fields and no sectioned/step flow on mobile —
      consider a step/accordion flow (Recipient → Dates/Payment → Line
      items) or collapsing less-common fields behind "more options" to
      shorten the pre-line-items scroll distance. Deferred here as a
      product/design decision rather than restructured unilaterally in the
      2026-09-14 fixer pass. (ux-mobile)
      Plan: `docs/plans/2026-09-14-invoice-creation-step-flow-mobile.md`
      (design decision: accordion with collapsed-section summaries, not a
      wizard — desktop layout unchanged)
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
- [ ] "Load demo data" empty-state CTA (`app/(app)/invoices/index.tsx`)
      routes unconditionally to Settings, but the demo-seed control there
      is hidden unless `EXPO_PUBLIC_ALLOW_DEV_SEED` is set (default off) —
      hide the CTA when the flag is off, or route straight to the seed
      control when it's on (2026-09-14 audit, ux-desktop)
- [ ] A partially-paid invoice past its due date never surfaces as
      overdue in its own status — `deriveInvoiceStatusFromPayment`
      (`lib/invoices/payment-status.ts`) only compares against `dueDate`
      in the `paidAmount <= 0` branch; once partially paid it
      unconditionally returns "partially_paid" regardless of due date.
      Introduce a combined status or an additional overdue flag the UI can
      badge; add a test for paidAmount between 0 and total with a past due
      date. (2026-09-14 audit, feature)
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
- [ ] Non-HUF invoices report a false HUF VAT base to NAV —
      `lib/nav/invoice-xml.ts:361` hardcodes `<exchangeRate>1</exchangeRate>`
      even though `invoice.exchangeRate` exists in `db/schema.ts` and
      `app/(app)/invoices/new.tsx` already collects it. Pass the stored rate
      into the XML, refuse to submit a non-HUF invoice that has no rate, and
      show the HUF VAT amount on the PDF/preview
      (`lib/invoices/build-pdf-context.ts` ignores `exchangeRate` entirely
      today). (needs tax/legal sign-off — which rate and which date govern
      the HUF VAT amount is an Áfa tv. question, not a code choice)
- [ ] Payment method and payment date never reach the NAV XML —
      `lib/nav/invoice-xml.ts` defers them as "schema placement not
      verified", but `invoiceDetail` in the published `invoiceData.xsd`
      carries `paymentMethod`/`paymentDate` and the columns already exist
      (`invoice.paymentMethod`, `invoice.paidAt`). Map transfer/cash/card to
      the XSD's own enum, verified by fetching the schema rather than
      guessing, with a fixture test like the `invoiceReference` work.
      (needs tax/legal sign-off)
- [ ] Díjbekérő (proforma) is a dead end — `lib/invoices/numbering.ts` mints
      DBK-/ELO- numbers and `lib/i18n/locales/hu.ts` labels them, but there
      is no way to turn a paid díjbekérő into the actual számla: nothing in
      `app/(app)/invoices/[id]/index.tsx`, `lib/invoices/service.ts` or
      `app/api/invoices/[id]/duplicate+api.ts` converts one document type
      into the next. Add a "convert to invoice" action that copies lines and
      client data into a new INV document and links the two, which is the
      standard collect-then-invoice flow every Hungarian competitor ships
      and the reason an EV issues a díjbekérő at all.

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
