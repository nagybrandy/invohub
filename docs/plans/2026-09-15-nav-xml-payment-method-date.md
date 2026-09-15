// docs/plans/2026-09-15-nav-xml-payment-method-date.md
# Plan — Payment method (and the truth about payment date) in the NAV XML

- Backlog item: Phase 1 — Core invoicing, NAV-compliant. Owner priority #4
  ("Payment method + payment date into the NAV XML (`paymentMethod`, `paidAt`)").
- Slug: `nav-xml-payment-method-date`
- Branch: `slice/nav-xml-payment-method-date`
- Date: 2026-09-15
- Risk: **tax-legal** (see §8) — ships as a **pull request for human sign-off**,
  must **not** auto-merge and must **not** auto-deploy.

---

## 1. Goal and user value

Every invoice InvoHub reports to NAV today is missing its **fizetési mód**.
`lib/nav/invoice-xml.ts:35` defers it explicitly ("schema placement not
verified"), even though the composer has collected it since the UX overhaul
(`components/invoices/composer/StepPartner.tsx:22-25`, default `transfer`) and
the column has existed for just as long (`db/schema.ts:185`). NAV's own
számla-megjelenítő shows fizetési mód to the taxpayer and to the buyer's
accountant; an EV whose készpénzes számla is reported with no payment method
gets a report that does not match the paper document they handed over.

**After this slice the EV gets:** the fizetési mód they picked actually reaches
NAV, mapped to NAV's own enum, in the element position NAV's schema requires —
and a `paymentDate` that is a valid `InvoiceDateType` even when the stored due
date carries a time component (today it is passed through raw, which would be
rejected by NAV's schema validation). The public `POST /api/v1/invoices` can
finally set a payment method at all.

### The backlog item's premise about `paidAt` is wrong — verified against the schema

The item says to map `paidAt` (actual payment date) to `paymentDate`. **It is
not that field.** From the published `invoiceData.xsd`, fetched 2026-09-15
from `nav-gov-hu/Online-Invoice`
(`src/schemas/nav/gov/hu/OSA/invoiceData.xsd`, `InvoiceDetailType`, lines
1113-1118):

```xml
<xs:element name="paymentDate" type="base:InvoiceDateType" minOccurs="0">
  <xs:documentation xml:lang="hu">Fizetési határidő</xs:documentation>
  <xs:documentation xml:lang="en">Deadline for payment</xs:documentation>
</xs:element>
```

`paymentDate` is the **fizetési határidő** — the due date. The builder already
emits `invoice.dueDate` there (`lib/nav/invoice-xml.ts:362`), which is
**correct and stays**. Turning it into `paidAt` would have replaced a correct
value with a wrong one in a mandatory data report.

OSA 3.0 has **no element for the actual payment date**. Checked, in the same
fetched schema: the full `InvoiceDetailType` sequence (lines 1040-1143),
`ConventionalInvoiceInfoType` (lines 633-690: orderNumbers, deliveryNotes,
shippingDates, contractNumbers, supplierCompanyCodes, customerCompanyCodes,
dealerCodes, costCenters, projectNumbers, generalLedgerAccountNumbers — nothing
payment-related), and `AdditionalDataType` (a free-form dataName/dataValue
escape hatch). So `invoice.paidAt` **stays out of the XML**, and we do not
invent an `additionalInvoiceData` convention to smuggle it in. Paid/unpaid
state is InvoHub's own bookkeeping and Phase 2's bank-matching concern, not
OSA data content. AC 10 pins this so a future agent does not "fix" it back.

---

## 2. Design decisions (so the implementer does not have to invent them)

**(a) Verified element position.** `InvoiceDetailType`'s `xs:sequence`
(invoiceData.xsd lines 1040-1143) is, in order: `invoiceCategory`,
`invoiceDeliveryDate`, `invoiceDeliveryPeriodStart`, `invoiceDeliveryPeriodEnd`,
`invoiceAccountingDeliveryDate`, `periodicalSettlement`,
`smallBusinessIndicator`, `currencyCode`, `exchangeRate`,
`utilitySettlementIndicator`, `selfBillingIndicator`, **`paymentMethod`**,
**`paymentDate`**, `cashAccountingIndicator`, `invoiceAppearance`,
`conventionalInvoiceInfo`, `additionalInvoiceData`. So `<paymentMethod>` goes
**immediately before** the `<paymentDate>` we already emit, after
`<exchangeRate>` and before `<invoiceAppearance>`. `minOccurs="0"` — it is
optional, so omitting it is always schema-valid.

**(b) Verified enum.** `base:PaymentMethodType` (invoiceBase.xsd lines
127-164) has exactly five values:

| InvoHub `PaymentMethod` | NAV enum | XSD hu documentation |
|---|---|---|
| `transfer` | `TRANSFER` | Banki átutalás |
| `cash` | `CASH` | Készpénz |
| `card` | `CARD` | Bankkártya, hitelkártya, egyéb készpénz helyettesítő eszköz |
| `other` | `OTHER` | Egyéb |
| *(no InvoHub equivalent)* | `VOUCHER` | Utalvány, váltó, egyéb pénzhelyettesítő eszköz |

`VOUCHER` has no InvoHub counterpart on the invoice side (the *receipt* module
has its own separate `voucher` value — out of scope, §9).

**(c) Omit rather than guess.** No stored payment method → **omit the element**.
It is optional in the schema, and reporting `OTHER` for "we don't know" would
assert something the EV never said. A non-empty value that is not one of the
four known ones (only reachable through DB drift) maps to `OTHER` — the EV did
record *something*, and `OTHER` is exactly "Egyéb". Never emit a literal
outside the enum: that fails NAV's schema validation outright.

**(d) Dates must satisfy `InvoiceDateType`.** invoiceBase.xsd lines 68-77:
`xs:date`, `minInclusive 2010-01-01`, pattern `\d{4}-\d{2}-\d{2}`. `dueDate`
and `issueDate` are plain `text` columns (`db/schema.ts`), and nothing in the
write path enforces the date-only shape — `POST /api/invoices` takes
`body.dueDate` as given. A timestamp in there produces an invalid report today.
`toNavDate` normalizes to the first 10 characters and validates shape, real
calendar date, and the 2010 lower bound.

**(e) The XML reports what the document carries, not what the UI defaults to.**
`buildNavInvoiceXml` reads `invoice.paymentMethod` only. It does not fall back
to the composer's `transfer` default, to the company profile, or to anything
else. `lib/invoices/mappers.ts:66` already resolves the legacy
"Fizetés: … in notes" era through `resolvePaymentMethod`, so old invoices get
their method for free without the XML builder knowing about notes parsing.

**(f) One new module.** `lib/nav/invoice-fields.ts` — pure scalar mappers from
InvoHub values to `invoiceDetail` field values, no I/O, no i18next. Keeps the
verified-against-XSD knowledge in one testable place, like the
`invoiceReference` work did.

---

## 3. Acceptance criteria (testable, numbered)

**`lib/invoices/payment-status.ts` (shared value list)**

1. `PAYMENT_METHODS` deep-equals `["transfer", "cash", "card", "other"]`.
   `isPaymentMethod("cash")` is `true`; `isPaymentMethod("CASH")`,
   `isPaymentMethod("voucher")`, `isPaymentMethod("")` and
   `isPaymentMethod(undefined)` are all `false`.

**`lib/nav/invoice-fields.ts` (new)**

2. `toNavPaymentMethod` maps `"transfer" → "TRANSFER"`, `"cash" → "CASH"`,
   `"card" → "CARD"`, `"other" → "OTHER"` (table-driven over `PAYMENT_METHODS`,
   so adding a method later fails this test until it is mapped).
3. `toNavPaymentMethod(undefined)`, `(null)`, `("")` and `("   ")` all return
   `null` (caller omits the element).
4. `toNavPaymentMethod("bitcoin")` returns `"OTHER"` — never a value outside
   the five-member enum, for any input.
5. `toNavDate("2026-06-15")` is `"2026-06-15"`;
   `toNavDate("2026-06-15T10:00:00.000Z")` is `"2026-06-15"`;
   `toNavDate("")`, `("tomorrow")`, `("2026-13-01")` (not a real month) and
   `("2009-12-31")` (below the XSD's `minInclusive`) all return `null`.

**NAV XML (`lib/nav/invoice-xml.ts`)**

6. `buildNavInvoiceXml(makeInvoice({ paymentMethod: "transfer" }), null)`
   contains exactly one `<paymentMethod>TRANSFER</paymentMethod>`, inside
   `<invoiceDetail>`.
7. Element order inside the `<invoiceDetail>` block matches
   `InvoiceDetailType`'s `xs:sequence`: index of `<currencyCode>` <
   `<exchangeRate>` < `<paymentMethod>` < `<paymentDate>` <
   `<invoiceAppearance>` (assert on `extractBlock(xml, "invoiceDetail")`).
8. `buildNavInvoiceXml(makeInvoice({ paymentMethod: undefined }), null)`
   contains no `<paymentMethod>` element, and still contains `<paymentDate>`
   and `<invoiceAppearance>` (omission does not disturb the rest).
9. All four InvoHub values produce their NAV enum value end-to-end through the
   builder (one parametrized test over `PAYMENT_METHODS`).
10. `paymentDate` is the **due date, not the payment date**: for
    `makeInvoice({ dueDate: "2026-06-15", paidAt: "2026-06-03T08:00:00.000Z" })`,
    `extractTag(xml, "paymentDate")` is `"2026-06-15"`, and the XML contains
    neither `"2026-06-03"` nor the raw `paidAt` string anywhere.
11. `makeInvoice({ dueDate: "2026-06-15T12:30:00.000Z" })` emits
    `<paymentDate>2026-06-15</paymentDate>` (date-only, schema-valid);
    `makeInvoice({ dueDate: "" })` omits `<paymentDate>` entirely rather than
    emitting an empty/invalid one — `<paymentMethod>` and
    `<invoiceAppearance>` are still present and correctly ordered.
12. `invoiceIssueDate` and `invoiceDeliveryDate` are date-normalized the same
    way (`issueDate: "2026-05-01T09:00:00Z"` → `2026-05-01`), and a value
    `toNavDate` cannot parse falls back to today's behaviour (the escaped raw
    string) so no currently-working invoice regresses — these two elements are
    mandatory (`minOccurs` unset) and must never be omitted.

**Public API (`lib/invoices/create-from-payload.ts`)**

13. `validateExternalInvoiceInput({ …valid…, paymentMethod: "bitcoin" })`
    returns a non-null string naming `paymentMethod` and listing
    `transfer, cash, card, other`; with `"cash"` it returns `null`; with the
    field omitted it returns `null`.
14. `createInvoiceFromPayload` with `paymentMethod: "cash"` produces an invoice
    whose `paymentMethod` is `"cash"`; with the field omitted it is
    `undefined` (no silent `transfer` default on the API path).

**Regression**

15. Every pre-existing case in `lib/nav/invoice-xml.test.ts` still passes
    untouched; `npx tsc --noEmit` is clean; `npm run test:unit` is green,
    including `lib/i18n/locales/en.test.ts`'s hu/en key-parity test.

---

## 4. Tests to write first (TDD — write, watch fail, then implement)

1. `lib/invoices/payment-status.test.ts` (extend) — AC 1.
2. `lib/nav/invoice-fields.test.ts` (**new**) — AC 2-5.
3. `lib/nav/invoice-xml.test.ts` (extend) — AC 6-12. Add the new cases at the
   end of the existing `describe`; do not edit an existing case.
4. `lib/invoices/create-from-payload.test.ts` (extend) — AC 13-14.

Order matters: 2 before 3 (the builder consumes the mappers), and the whole of
3 must be red before `invoice-xml.ts` is touched.

---

## 5. Files to touch

| File | Change |
|---|---|
| `lib/nav/invoice-fields.ts` | **new** — `NavPaymentMethod` type (`"TRANSFER" \| "CASH" \| "CARD" \| "OTHER" \| "VOUCHER"`), `toNavPaymentMethod(value: string \| null \| undefined): NavPaymentMethod \| null`, `toNavDate(value: string \| null \| undefined): string \| null`. Header comment cites the exact XSD file, type names and line numbers the mapping was verified against |
| `lib/nav/invoice-fields.test.ts` | **new** — AC 2-5 |
| `lib/nav/invoice-xml.ts` | emit `<paymentMethod>` between `<exchangeRate>` and `<paymentDate>` when `toNavPaymentMethod` returns non-null; route `paymentDate` through `toNavDate` (omit when null); route `invoiceIssueDate`/`invoiceDeliveryDate` through `toNavDate` with a raw fallback; rewrite the "Known simplifications" bullet at line 35-36 — the payment fields are no longer deferred, and the `paidAt`-has-no-home finding from §1 replaces it |
| `lib/nav/invoice-xml.test.ts` | extend — AC 6-12 |
| `lib/invoices/payment-status.ts` | add `export const PAYMENT_METHODS: PaymentMethod[]` and `export function isPaymentMethod(value: unknown): value is PaymentMethod` (this file already owns `PaymentMethod` resolution, incl. the legacy notes fallback) |
| `lib/invoices/payment-status.test.ts` | extend — AC 1 |
| `lib/invoices/create-from-payload.ts` | `paymentMethod?: PaymentMethod` on `ExternalInvoiceInput`; validate with `isPaymentMethod`; set it on the built invoice |
| `lib/invoices/create-from-payload.test.ts` | extend — AC 13-14 |
| `docs/external-api.md` | one row in the request-body table (after `currency`): `paymentMethod` \| string \| nem \| `transfer`, `cash`, `card`, `other` |
| `docs/nav-test-setup.md` | under "Nyitott kérdések / ellenőrizendő pontok": record that `paymentMethod`/`paymentDate` are now emitted and verified against the XSD, and that OSA 3.0 has no actual-payment-date element |
| `docs/loop-queue.md` | item marked `[~] folyamatban (slice/nav-xml-payment-method-date)` (done by this plan's commit) + the follow-ups in §9 |

**No change needed** in `lib/nav/submit-outgoing.ts` (it passes the whole
`Invoice` through), `lib/invoices/mappers.ts` (both directions already carry
`paymentMethod`), `app/api/invoices+api.ts` (`POST` already copies
`body.paymentMethod` — unlike `exchangeRate`, which the sibling slice fixes),
or any composer file (`StepPartner.tsx` already collects the value).

### Rebase note — overlap with the in-flight exchange-rate slice

`slice/non-huf-invoice-exchange-rate-nav-xml` (open, tax-legal gated, not in
`main`) rewrites the `<exchangeRate>` line **in the same `<invoiceDetail>`
template literal** and threads a resolved rate through the builder. To stay
rebasable:

- Branch from `main`, not from that branch.
- Keep this slice's edit to the template **additive**: one new interpolated
  line for `<paymentMethod>`, plus swapping three date expressions for
  `toNavDate(...)` calls. Do not restructure `buildNavInvoiceXml`'s signature
  or its summary/line helpers.
- If that slice lands first, the conflict is a two-line textual one inside the
  same template; re-apply on top and keep both changes.

---

## 6. i18n keys (hu + en)

**None.** This slice adds no user-facing string: the change is XML the NAV
system consumes, plus an English API validation message (`create-from-payload`
returns plain English error strings by design — see its existing
`status must be one of …` messages — and those are not translated). The four
payment methods already have complete hu+en labels at
`invoices.paymentMethods.{transfer,cash,card,other}`
(`lib/i18n/locales/hu.ts:281-286`, `lib/i18n/locales/en.ts:280-285`) and this
slice reuses them without adding or renaming any key, so
`lib/i18n/locales/en.test.ts`'s parity test stays green untouched.

If the implementer finds themselves needing a new key, that is a signal the
slice has grown a UI change it should not have — stop and check §9.

---

## 7. db/schema.ts changes

**None — neither ADDITIVE nor DESTRUCTIVE.** `invoice.paymentMethod`
(`text("payment_method")`, nullable, `db/schema.ts:185`) and `invoice.paidAt`
(`timestamp("paid_at")`, `db/schema.ts:186`) both already exist, and
`lib/invoices/mappers.ts` already reads and writes both. No migration, no
`drizzle-kit generate`, no `db:push` in this slice.

---

## 8. Risk classification

**`tax-legal`.** Reason: this changes the content of a mandatory NAV Online
Számla data report — `lib/nav/` submission behaviour is explicitly sign-off
gated in `CLAUDE.md`, and fizetési mód / fizetési határidő are invoice content
an Áfa tv. reviewer should confirm. Ship as a **PR for human sign-off; no
auto-merge, no auto-deploy.** All work stays on `demo`/`test` NAV modes; no
production endpoint is called, no credential is invented, and no tax figure is
introduced.

### Open questions for the human reviewer (state them in the PR body)

- **OQ-1 — omit vs. `OTHER` when nothing is recorded.** The code omits the
  optional element (§2c). If NAV's business validation or the reviewer prefers
  an explicit `OTHER`, it is a one-line change plus AC 3/8.
- **OQ-2 — storno / helyesbítő documents.** `createStornoInvoice`
  (`lib/invoices/service.ts:333`) deliberately clears `paymentMethod` on the
  storno document, so a storno is reported with no fizetési mód. Should a
  módosító okirat repeat the original's payment method? Not decided in code
  here — that would be inventing a rule.
- **OQ-3 — a method changed after submission.** `markInvoicePaid` can set a
  different `paymentMethod` after the invoice was already reported (e.g.
  invoiced as átutalás, paid in készpénz). InvoHub sends no MODIFY for that
  today. Whether a correction is required is a tax question, not a code one.
- **OQ-4 — `paymentDate` on a cash invoice.** The due date is always emitted,
  including for CASH invoices that were paid on the spot. Confirm that is
  what NAV expects rather than omitting the optional element.
- **OQ-5 — `paidAt` has no OSA home.** Confirm the §1 finding: the actual
  payment date is not OSA data content and should not be pushed into
  `additionalInvoiceData`.

---

## 9. Out of scope (file as follow-ups, do not do here)

- **`invoice.paidAt` in the NAV XML** — no element exists for it (§1). If the
  reviewer disagrees on OQ-5, that is a new item, not a widening of this one.
- `VOUCHER` as an InvoHub invoice payment method — the union is four values
  (`lib/invoices/types.ts:38`) and adding a fifth touches the composer pills,
  the detail screen pills, both locales and the legacy notes parser.
- The nyugta / e-receipt payment methods (`lib/receipts/`,
  `lib/nav-receipt/`) — a different schema on a different queue item.
- `exchangeRate` and the HUF amounts — the in-flight
  `slice/non-huf-invoice-exchange-rate-nav-xml`.
- Validating `body.paymentMethod` in `POST /api/invoices` — that route takes a
  `Partial<Invoice>` wholesale and deserves one validation pass for all of its
  fields, not a per-field patch that collides with the exchange-rate slice.
  **File as a new queue item.**
- Showing fizetési mód on the PDF / HTML document — the in-flight
  `slice/hungarianize-brand-invoice-preview-pdf` owns those renderers.
- `cashAccountingIndicator` (pénzforgalmi elszámolás), `selfBillingIndicator`,
  `periodicalSettlement`, `smallBusinessIndicator` — other optional
  `invoiceDetail` fields InvoHub has no data for. **File one queue item** to
  review them together against the XSD.
- Re-submitting invoices already reported to NAV without a payment method — a
  MODIFY question for the reviewer (OQ-3), not this slice.
- Tap targets on the payment-method pills — already its own open item.

---

## 10. UX notes

**No screen changes in this slice** — the value is already collected. What
matters is that the implementer does not accidentally change where it comes
from:

**Mobile (375px).** The fizetési mód pills live in `StepPartner.tsx`
(step 1 of the 3-step composer), rendered as a wrapping row of four pills with
`transfer` preselected, so a HUF átutalásos számla — the common EV case —
needs zero extra taps and now reports correctly by default. Those pills are
still under the 44px tap-target minimum; that is a separate open queue item
and **must not** be fixed here (it would put a UI diff in a tax-legal PR).

**Desktop (≥768px).** The same pills sit in the composer's left column and the
chosen method is echoed in `StepReview.tsx:70` via
`t("invoices.paymentMethods.${paymentMethod}")` — after this slice that echoed
label is exactly what NAV receives, which is the property a reviewer will want
to eyeball. The invoice detail screen
(`app/(app)/invoices/[id]/index.tsx:53-56`) offers the same four values in the
"mark as paid" dialog; see OQ-3 for the post-submission divergence.

**Nothing regresses visually** — if a screenshot diff shows up in review, the
slice has overreached.

---

## 11. Definition of done

- AC 1-15 green; `npx tsc --noEmit` clean; `npm run test:unit` green.
- No NAV production call, no new credential, no schema migration, no i18n key.
- Branch `slice/nav-xml-payment-method-date`, one PR, OQ-1…OQ-5 spelled out in
  the PR body (OQ-5 especially — it contradicts the backlog item's own
  wording), `docs/loop-queue.md` left `[~]` until a human signs off.
