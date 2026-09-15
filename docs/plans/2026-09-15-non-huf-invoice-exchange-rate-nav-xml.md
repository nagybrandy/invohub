// docs/plans/2026-09-15-non-huf-invoice-exchange-rate-nav-xml.md
# Plan — Non-HUF invoices: real exchange rate in the NAV XML, HUF VAT on the document

- Backlog item: Phase 1 — Core invoicing, NAV-compliant. Owner priority #3
  ("Non-HUF invoices: use `invoice.exchangeRate` for the HUF VAT base in the
  NAV XML and on the PDF").
- Slug: `non-huf-invoice-exchange-rate-nav-xml`
- Branch: `slice/non-huf-invoice-exchange-rate-nav-xml`
- Date: 2026-09-15
- Risk: **tax-legal** (see §8) — ships as a **pull request for human sign-off**,
  must **not** auto-merge and must **not** auto-deploy.

---

## 1. Goal and user value

An EV who invoices a foreign client in EUR today gets a document and a NAV
report that are both wrong, silently.

What the code actually does right now (verified, not assumed):

1. `lib/nav/invoice-xml.ts:361` hardcodes `<exchangeRate>1</exchangeRate>`,
   and **every** `…HUF` element in the XML (`lineNetAmountHUF`,
   `lineVatAmountHUF`, `lineGrossAmountNormalHUF`, `vatRateNetAmountHUF`,
   `vatRateVatAmountHUF`, `vatRateGrossAmountHUF`, `invoiceNetAmountHUF`,
   `invoiceVatAmountHUF`, `invoiceGrossAmountHUF`) is filled with the
   **document-currency** number. A €1 000 invoice is therefore reported to NAV
   as 1 000 Ft net and 270 Ft VAT. That is a false HUF VAT base in a
   mandatory data report — the single most serious defect in the Phase 1
   queue that is not a missing feature.
2. `app/api/invoices+api.ts`'s `POST` handler builds its `Invoice` field by
   field and **never copies `body.exchangeRate`**, so the rate the composer
   collects (`components/invoices/composer/useInvoiceComposer.ts:334/417`) is
   dropped on the floor for every newly created invoice. The column
   (`db/schema.ts:181`) and both mappers (`lib/invoices/mappers.ts:61/113`)
   are fine — the create path is the leak. `PATCH /api/invoices/[id]`
   spreads the body so it survives there; that asymmetry is why the field
   looks like it works when you edit an invoice.
3. `lib/invoices/create-from-payload.ts` (the public `POST /api/v1/invoices`)
   has no `exchangeRate` in `ExternalInvoiceInput` at all, and happily accepts
   `currency: "EUR"` with no rate.
4. `lib/invoices/build-pdf-context.ts` / `generate-pdf.ts` /
   `preview-html.ts` ignore `exchangeRate` entirely, so the EUR invoice the
   customer receives carries no forint VAT figure — which
   `.claude/skills/hu-invoicing-rules/SKILL.md` lists among the mandatory
   contents ("Currency, and the exchange rate if not HUF").

**After this slice the EV gets:**

- A EUR/foreign-currency invoice whose NAV report carries the real HUF base —
  or **no submission at all**, with a clear Hungarian error, when the rate is
  missing. Never a silently false report.
- The rate they typed actually saved (the create path stops dropping it) and
  required before a non-HUF invoice can be finalized, so the failure is
  caught in the composer rather than at NAV submission time.
- A document (HTML preview + PDF) that shows the exchange rate used and the
  VAT amount in forint next to the EUR VAT amount.

Nothing here decides *which* rate or *which date's* rate is legally correct —
that is the Áfa tv. question this item is gated on (§8). The code takes the
rate the user entered, uses it consistently everywhere, and refuses to guess.

---

## 2. Design decisions (so the implementer does not have to invent them)

**(a) One pure module owns the conversion.** `lib/invoices/exchange-rate.ts`,
no I/O, no i18next import — importable from the NAV builder, the PDF builder
and the composer alike.

```ts
export function requiresExchangeRate(currency: InvoiceCurrency): boolean;   // currency !== "HUF"
export function parseExchangeRateInput(raw: string): number | null;         // "390,5" | "390.5" -> 390.5; <= 0 / NaN -> null
export function resolveExchangeRate(
  invoice: Pick<Invoice, "currency" | "exchangeRate">
): { ok: true; rate: number } | { ok: false; reason: "missing" | "invalid" };
export function toHufAmount(amount: number, rate: number): number;          // round to 2 decimals
export function formatExchangeRate(rate: number): string;                   // up to 6 decimals, trailing zeros trimmed, "." separator (XML)
```

For `currency === "HUF"`, `resolveExchangeRate` returns `{ ok: true, rate: 1 }`
regardless of what is stored — a HUF invoice never needs one.

**(b) Convert per line, then sum — never convert the total.** NAV
cross-validates that the per-line HUF amounts add up to the
`summaryByVatRate` and invoice-level HUF totals. So `buildSummaryXml` must
sum the **already-rounded per-line HUF values**, not convert an already-summed
document-currency total. This is the one arithmetic subtlety in the slice;
AC 5 pins it.

**(c) Refuse, don't guess.** `buildNavInvoiceXml` throws when the invoice is
non-HUF and `resolveExchangeRate` fails. `submitOutgoingInvoiceToNav` lets
that error surface (it already does this for a missing `invoiceReference`),
so no `navSubmission` row is written for a report that was never valid. The
composer surfaces it as a field error before save, so the throw is a
backstop, not the normal UX.

**(d) HUF rounding stays at 2 decimals — deliberately not rounded to whole
forint.** `formatAmount` already emits 2 decimals for every amount, and
whether the HUF VAT amount must be rounded to the forint is exactly the
tax question this item is gated on. Keeping the existing precision changes
one thing only (the rate), which is the reviewable change. Listed as open
question OQ-2 for sign-off.

**(e) No MNB rate fetch, no rate-date column.** Out of scope (§9). The date
whose rate governs is OQ-1.

---

## 3. Acceptance criteria (testable, numbered)

**`lib/invoices/exchange-rate.ts`**

1. `requiresExchangeRate("EUR")` is `true`, `requiresExchangeRate("HUF")` is
   `false`. `parseExchangeRateInput("390,5")` and `("390.5")` both return
   `390.5`; `("")`, `("0")`, `("-1")`, `("abc")` return `null`.
2. `resolveExchangeRate({ currency: "HUF", exchangeRate: undefined })` is
   `{ ok: true, rate: 1 }`; `{ currency: "HUF", exchangeRate: 390 }` is also
   `{ ok: true, rate: 1 }` (a stored rate on a HUF invoice is ignored, never
   applied). `{ currency: "EUR", exchangeRate: undefined }` is
   `{ ok: false, reason: "missing" }`; `{ currency: "EUR", exchangeRate: 0 }`
   and a negative rate are `{ ok: false, reason: "invalid" }`.
3. `toHufAmount(100.005, 390.5)` rounds to 2 decimals;
   `formatExchangeRate(390.5) === "390.5"` and `formatExchangeRate(1) === "1"`
   (no trailing zeros, `.` as decimal separator — this value goes into XML).

**NAV XML (`lib/nav/invoice-xml.ts`)**

4. For `makeInvoice({ currency: "EUR", exchangeRate: 390.5 })` with one line
   (qty 2 × 100, 27%): `<exchangeRate>` is `390.5`; `<currencyCode>` stays
   `EUR`; `lineNetAmount` is `200.00` but `lineNetAmountHUF` is `78100.00`;
   `lineVatAmount` is `54.00` and `lineVatAmountHUF` is `21087.00`;
   `lineGrossAmountNormalHUF` is `99187.00`.
5. Cross-sum consistency: for a two-line EUR invoice with different VAT rates,
   `invoiceNetAmountHUF` equals the sum of the two `lineNetAmountHUF` values
   and `invoiceVatAmountHUF` equals the sum of the two `lineVatAmountHUF`
   values, exactly (string compare of the formatted amounts); the same holds
   per `summaryByVatRate` group.
6. A HUF invoice is byte-for-byte unchanged versus today: `<exchangeRate>1</exchangeRate>`
   and every `…HUF` element equal to its document-currency sibling. (Snapshot
   the existing HUF fixture's output before touching the builder and assert it
   after.)
7. `buildNavInvoiceXml(makeInvoice({ currency: "EUR", exchangeRate: undefined }), company)`
   **throws**, and the message names the invoice number and says the exchange
   rate is missing. Same for `exchangeRate: 0`.
8. Zero-VAT treatments keep working with a rate: an `AAM` line on a EUR
   invoice emits `vatRateVatAmountHUF` `0.00` and a non-zero
   `vatRateNetAmountHUF`.

**Submission (`lib/nav/submit-outgoing.ts`)**

9. `submitOutgoingInvoiceToNav` for a non-HUF invoice with no rate rejects,
   **no** `navSubmission` row is inserted and `client.manageInvoice` is never
   called (assert on the mocks).

**Persistence**

10. `POST /api/invoices` with `{ currency: "EUR", exchangeRate: 390.5, … }`
    passes `exchangeRate: 390.5` to `upsertInvoice` (today it passes
    `undefined`); with `currency: "HUF"` it passes `undefined` even when the
    body carries a rate.
11. `validateExternalInvoiceInput({ …, currency: "EUR" })` (no rate) returns a
    non-null error string mentioning `exchangeRate`; with
    `exchangeRate: 390.5` it returns `null` and
    `createInvoiceFromPayload` puts `390.5` on the created invoice.
    `exchangeRate: -1` or `"390"` (string) is rejected.

**Composer**

12. `validateExchangeRateInput("", "EUR")` is invalid with message key
    `invoices.errors.exchangeRateRequired`; `("0", "EUR")` is invalid with
    `invoices.errors.exchangeRateInvalid`; `("390,5", "EUR")` and `("", "HUF")`
    are valid.
13. `useInvoiceComposer`'s save is blocked for a non-HUF invoice with an empty
    rate: `apiFetch`/`addOrUpdate` is not called, the partner step is flagged
    (`stepErrors.partner === true`) and the error text is rendered — asserted
    in `useInvoiceComposer.test.tsx`.

**Document (HTML preview + PDF)**

14. `generateInvoicePreviewHtml(makeInvoice({ currency: "EUR", exchangeRate: 390.5 }))`
    contains the rate (`390,5`, formatted for display) and the VAT total in
    forint (`21 087 Ft`-shaped, i.e. produced by the same amount formatter the
    rest of the document uses); a HUF invoice's output contains neither block
    (assert absence).
15. The generated PDF's drawn texts contain the forint VAT line for the EUR
    invoice and do not for a HUF invoice (`mockDrawnTexts`, same technique as
    the existing PDF tests).

**Regression**

16. `npx tsc --noEmit` clean; `npm run test:unit` green, including
    `lib/i18n/locales/en.test.ts`'s hu/en key-parity test.

---

## 4. Tests to write first (TDD — write, watch fail, then implement)

1. `lib/invoices/exchange-rate.test.ts` (**new**) — AC 1–3.
2. `lib/nav/invoice-xml.test.ts` (extend) — AC 4–8. Add a two-line EUR
   fixture; keep every existing case untouched (AC 6 is the guard that the HUF
   path did not move).
3. `lib/nav/submit-outgoing.test.ts` (extend) — AC 9.
4. `__tests__/api/invoices/invoices-api.test.ts` (**new** — `__tests__/api/invoices/`
   has tests for `[id]`, links, mark-paid and storno/modify, but none for the
   collection route; mirror `invoice-id-api.test.ts`'s mocking of `@/db` and
   `@/lib/api/session`) — AC 10.
5. `lib/invoices/create-from-payload.test.ts` (extend) — AC 11.
6. `components/invoices/composer/composer-logic.test.ts` (extend) — AC 12;
   `components/invoices/composer/useInvoiceComposer.test.tsx` (extend) — AC 13.
7. `lib/invoices/preview-html.test.ts` (extend) — AC 14;
   `lib/invoices/generate-pdf.test.ts` (extend) — AC 15.

---

## 5. Files to touch

| File | Change |
|---|---|
| `lib/invoices/exchange-rate.ts` | **new** — the pure module in §2(a) |
| `lib/invoices/exchange-rate.test.ts` | **new** |
| `lib/nav/invoice-xml.ts` | resolve the rate once at the top of `buildNavInvoiceXml` (throw on failure); thread it into `buildLineXml` and `buildSummaryXml`; emit `formatExchangeRate(rate)`; every `…HUF` element becomes `formatAmount(toHufAmount(x, rate))`; summary HUF totals sum the per-line HUF values (§2(b)). Update the "Known simplifications" header comment — the `exchangeRate` bullet is now resolved, and the new open questions (OQ-1/OQ-2) replace it |
| `lib/nav/invoice-xml.test.ts` | extend (AC 4–8) |
| `lib/nav/submit-outgoing.test.ts` | extend (AC 9) — no production-code change needed in `submit-outgoing.ts` itself, the throw propagates; verify and only touch it if it swallows the error |
| `app/api/invoices+api.ts` | `POST` carries `exchangeRate` from the body (normalized: only when `currency !== "HUF"` and the value is a positive finite number) |
| `lib/invoices/create-from-payload.ts` | `exchangeRate?: number` on `ExternalInvoiceInput`; validation (AC 11); set it on the built invoice |
| `lib/invoices/create-from-payload.test.ts` | extend |
| `components/invoices/composer/composer-logic.ts` | `validateExchangeRateInput(raw, currency)` returning the existing `StepValidationResult` shape |
| `components/invoices/composer/composer-logic.test.ts` | extend |
| `components/invoices/composer/useInvoiceComposer.ts` | run the new validator in the same place `validatePartnerStep`/`validateDueDate` run; add `exchangeRate` to `ComposerErrors` handling (reuse the `partner` slot rather than adding a step); clear it on edit like the other fields |
| `components/invoices/composer/useInvoiceComposer.test.tsx` | extend (AC 13) |
| `components/invoices/composer/StepPartner.tsx` | mark the rate field required for non-HUF, show the error text under it, `inputMode="decimal"` already effectively set via `keyboardType="decimal-pad"` |
| `lib/invoices/preview-html.ts` | when `requiresExchangeRate(invoice.currency)` and a rate resolves, render one extra totals row: rate used + VAT in HUF |
| `lib/invoices/preview-html.test.ts` | extend (AC 14) |
| `lib/invoices/generate-pdf.ts` | same block via the existing `drawTotalLine` helper, right under the VAT line |
| `lib/invoices/generate-pdf.test.ts` | extend (AC 15) |
| `lib/i18n/locales/hu.ts`, `lib/i18n/locales/en.ts` | keys in §6 |
| `docs/loop-queue.md` | item `[~] folyamatban (slice/non-huf-invoice-exchange-rate-nav-xml)` (already done by this plan commit), plus the follow-up items in §9 |

`lib/invoices/build-pdf-context.ts` itself needs **no** change: it already
passes the whole `invoice` (which carries `exchangeRate`) into the PDF
context. The backlog item's phrasing ("ignores `exchangeRate` entirely")
describes the *rendering*, which lives in `generate-pdf.ts` /
`preview-html.ts`.

### Rebase note — overlap with the in-flight branding slice

`slice/hungarianize-brand-invoice-preview-pdf` (open PR, tax-legal gated, not
merged into `main`) **rewrites** `lib/invoices/preview-html.ts` and relabels
`lib/invoices/generate-pdf.ts`, and introduces `lib/invoices/document-labels.ts`
with `formatDocumentAmount`. To keep this slice rebasable:

- Branch from `main`, not from that branch.
- Keep the document change to **one additive block** appended to the totals
  section in each file — do not restructure either renderer.
- Format the HUF amount with whatever amount formatter the file already uses
  (`formatCurrency` on `main`). If the branding slice has landed by
  implementation time, use its `formatDocumentAmount` and the
  `invoices.document.*` namespace instead, and put the labels there.

---

## 6. i18n keys (hu + en)

Add under `invoices.errors` (namespace exists in both locales):

| Key | hu | en |
|---|---|---|
| `invoices.errors.exchangeRateRequired` | `"Nem forint pénznemű számlához kötelező megadni az árfolyamot."` | `"A non-HUF invoice requires an exchange rate."` |
| `invoices.errors.exchangeRateInvalid` | `"Az árfolyam csak nullánál nagyobb szám lehet."` | `"The exchange rate must be a number greater than zero."` |
| `invoices.errors.navExchangeRateMissing` | `"A NAV beküldés nem indítható el: hiányzik a számla HUF árfolyama."` | `"NAV submission cannot start: the invoice has no HUF exchange rate."` |

Add for the document itself (on `main` there is no `invoices.document.*`
namespace yet — create it; if the branding slice has landed, these join its
existing namespace):

| Key | hu | en |
|---|---|---|
| `invoices.document.exchangeRate` | `"Árfolyam"` | `"Exchange rate"` |
| `invoices.document.exchangeRateValue` | `"1 {{currency}} = {{rate}} HUF"` | `"1 {{currency}} = {{rate}} HUF"` |
| `invoices.document.vatInHuf` | `"ÁFA összege forintban"` | `"VAT amount in HUF"` |

The outgoing document is Hungarian regardless of UI language (the branding
slice's AC 1) — on `main` the renderers take no locale, so the implementer
inlines the Hungarian strings from the locale object the same way the rest of
the file does today, and does **not** wire i18next into a server module.
`lib/i18n/locales/en.test.ts`'s parity test covers the keys automatically.

---

## 7. db/schema.ts changes

**None.** `invoice.exchangeRate` — `numeric("exchange_rate", { precision: 12,
scale: 6 })`, nullable — already exists at `db/schema.ts:181`, and both
directions of `lib/invoices/mappers.ts` already read and write it. No
migration, no `drizzle-kit generate`, no `db:push` in this slice.

(For completeness: were a rate *date* column added later it would be
**ADDITIVE** — a new nullable `text` column. It is deliberately **not** in this
slice; see OQ-1.)

---

## 8. Risk classification

**`tax-legal`.** Reason: this changes what InvoHub reports to NAV as the HUF
VAT base of a non-HUF invoice, and adds a forint VAT figure to the legal
document the customer receives. `lib/nav/` submission behaviour and Áfa tv.
mandatory content are both explicitly sign-off-gated in `CLAUDE.md`. Ship as a
**PR for human sign-off; no auto-merge, no auto-deploy.** All work stays on
`demo`/`test` NAV modes; no production endpoint is called and no credential is
invented.

### Open questions for the human reviewer (state them in the PR body)

- **OQ-1 — which date's rate governs.** The code uses the single rate stored
  on the invoice, with no date attached. Áfa tv. ties the HUF conversion to a
  specific date (delivery/fulfilment vs. issue) and to a specific rate source
  (MNB, ECB, or the issuer's own declared bank rate). The invoice already has
  both `issueDate` and `invoiceDeliveryDate`. **Do not resolve this in code** —
  the reviewer decides, and the follow-up item implements it.
- **OQ-2 — HUF rounding.** The HUF amounts keep the existing 2-decimal
  formatting. If the forint VAT amount must be rounded to whole forint, that
  is a one-line change in `toHufAmount` plus the ACs that pin the digits.
- **OQ-3 — document wording.** "ÁFA összege forintban" and
  "1 EUR = 390,5 HUF" are plain-language labels, not verified legal wording.

---

## 9. Out of scope (file as follow-ups, do not do here)

- Automatic MNB (or any) exchange-rate lookup — the rate stays manual; the
  hint `invoices.fields.exchangeRateHint` already says so.
- An `exchangeRateDate` / rate-source column and UI (blocked on OQ-1).
- Currencies beyond `EUR` — `InvoiceCurrency` is `"EUR" | "HUF"` today and
  stays that way in this slice.
- `paymentMethod` / `paymentDate` in the NAV XML — the next queue item.
- The Hungarianization/branding of the preview and PDF — the in-flight
  `slice/hungarianize-brand-invoice-preview-pdf`.
- The pdfkit `ő`/`ű` font problem — its own queue item.
- Backfilling `exchange_rate` for existing non-HUF rows created before this
  fix (they were saved with the rate dropped). **File this as a new queue
  item**: those invoices cannot be NAV-submitted after this change without an
  edit, which is the correct-but-visible consequence; they need a listing or a
  prompt, not a guessed rate.
- Retro-correcting any non-HUF invoice already reported to NAV with rate 1 —
  a MODIFY submission question for the reviewer, not for this slice.
- Tap-target / pill work on the currency selector (separate open item).

---

## 10. UX notes

**Mobile (375px).** The currency pills and the rate input sit in one `HStack`
in `StepPartner.tsx` (the `Pénznem` row). At 375px the rate field's
`min-w-[140px]` plus the two pills already wraps; adding a required marker and
an error line under the field must not push the row into a horizontal scroll —
let the `HStack` wrap and give the error its own full-width line below, styled
like the other composer field errors. The field appears **only** for non-HUF,
so the default HUF flow gains zero steps. Keep `keyboardType="decimal-pad"`,
and accept a comma decimal separator (`parseExchangeRateInput`) — a Hungarian
phone keyboard offers `,`, and rejecting "390,5" as invalid would be the most
likely real-world failure of this whole slice.

**Desktop (≥768px).** The composer's persistent summary/preview panel shows
the document; the new forint-VAT row appears in the preview's totals block for
non-HUF invoices, directly under the VAT row, so the EV sees the HUF figure
they are reporting while still editing. `StepReview.tsx` already prints
`currency · exchangeRate` (line 75) — leave it, it now reflects a value that is
actually persisted.

**Error timing.** The rate error is raised on save/step-advance, not on every
keystroke (match `validateDueDate`'s existing behaviour: set on submit, clear
as soon as the value becomes valid).

---

## 11. Definition of done

- AC 1–16 green; `npx tsc --noEmit` clean; `npm run test:unit` green.
- No NAV production call, no new credential, no schema migration.
- Branch `slice/non-huf-invoice-exchange-rate-nav-xml`, one PR, OQ-1/OQ-2/OQ-3
  spelled out in the PR body, `docs/loop-queue.md` left `[~]` until a human
  signs off.
