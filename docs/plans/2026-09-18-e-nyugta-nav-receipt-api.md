// docs/plans/2026-09-18-e-nyugta-nav-receipt-api.md
# Plan — e-nyugta: rebuild the NAV eRECEIPT client against the real published interface (slice 1 of 3)

- Backlog item: Phase 1 — Core invoicing, NAV-compliant. Priority #7 in
  `docs/loop-queue.md`, and the matching detailed entry under "Remaining for
  the launch gate".
- Slug: `e-nyugta-nav-receipt-api`
- Branch: `slice/e-nyugta-nav-receipt-api` (created by the Build phase in its
  own worktree — not by this plan)
- Date: 2026-09-18
- Risk: **tax-legal** (§8) — ships as a **pull request for human sign-off**.
  Must not auto-merge, must not auto-deploy.
- **Supersedes `docs/plans/2026-09-16-e-nyugta-nav-receipt-api.md`.** That
  plan was never built (the loop stopped after the Plan phase; the
  `slice/e-nyugta-nav-receipt-api` branch is still at `main`). This revision
  re-verified every schema claim against the published XSD (§1.2), corrects
  three of them, and cuts scope so one Sonnet run can finish it.

---

## 1. Goal and user value

`lib/nav-receipt/` today talks to an interface that **does not exist**. It
posts to `https://api-test.onlineszamla.nav.gov.hu/receipt-if/v1` with a
namespace (`http://schemas.nav.gov.hu/receipt/1.0/api`), root elements
(`TokenExchangeRequest`, `ReceiptDataReportRequest`) and fields (`netAmount`,
`vatAmount`, `grossAmount`, `vatRateCode`, `startReceiptNumber`,
`endReceiptNumber`, `cancelledCount`) that were invented in
`xml-builder.ts`. `auth.ts` posts **JSON** to `/authenticate` and computes
**no request signature at all**. Every "NAV teszt" receipt submission an EV
makes today fails at the network or is rejected, and the receipt detail
screen shows a bare "Nincs beküldve" badge with no reason.

Nyugta-adatszolgáltatás is mandatory for EVs issuing nyugta. For those users
this is a hard Phase 1 launch blocker.

**After this slice the EV gets:** a receipt data report built against NAV's
published XSD and signed the way NAV's published spec requires, sent to NAV's
real test host; the NAV-issued report id stored and shown on the receipt;
NAV's own Hungarian error text on screen when a report is rejected; and an
explicit, honest "no exchange rate on file" refusal instead of a silently
wrong non-HUF report. Demo mode stays the default and stays a local
simulation — no EV needs a NAV account to use InvoHub.

### 1.1 Interface facts used by this plan

| Fact | Value |
|------|-------|
| Spec | `docs/specification/NAV_Nyugta_adatszolgaltatas_IF_specifikacio_v1.3.pdf` (v1.3 is the latest published; the backlog says v1.2) |
| Schema | `xsd/1.1/receipt_datareport/receipt-if-schema-v1.1.1.xsd` |
| Target namespace | `http://schemas.nav.gov.hu/NTCA/1.0/receipt` |
| Common schemas | `nav-gov-hu/Common`, tag `common-2.0.0-rc.2`, namespaces `.../NTCA/2.0/common/{service,authservice,type,string,customer}` |
| Test base | `https://bv-receipt-if.enyugta.nav.gov.hu/v1` |
| Operations | `POST /auth/token`, `/receipt/create`, `/receipt/modify`, `/receipt/invalidate`, `/receipt/list`, `/receipt/detail`, `/issuing-software/create`, `/issuing-software/list`, `/vat-category/list`, `/currency/list` |
| Auth | `POST /auth/token` returns `<token>` + `<validTo>`; every other call sends `Authorization: Bearer <token>` |

`requestSignature` = `SHA3-512(requestId + timestamp[yyyyMMddHHmmss UTC] +
signKey)`, uppercase hex — **exactly** what `lib/nav/crypto.ts`
`buildRequestSignature()` already computes for OSA with no invoice
operations. Reuse it; do not write a second SHA3 implementation.

### 1.2 Verified against the XSD on 2026-09-18 (do not re-derive from memory)

Downloaded and read: `receipt-if-schema-v1.1.1.xsd`, plus `service.xsd`,
`authservice.xsd`, `type.xsd`, `customer.xsd` from `common-2.0.0-rc.2`.

`CreateReceiptRequestType` extends `ntcaService:BaseRequestType`. Child
sequence, in this exact order:

```
s:context{requestId, timestamp}     from BaseRequestType
taxPayerId                          ntcaCustomer:TaxpayerIdType  = [0-9]{8}
issuingSoftware/name                IssuingSoftwareNameType, ≤100 chars
applicableDate                      GenericDateType  = \d{4}-\d{2}-\d{2}
serialNumber                        ReceiptSerialNumberType, 1..50
currency                            ntcaCustomer:CurrencyType = [A-Z]{3}
exchangeRate                        ExchangeRateType, nillable="true"
vatCategoryItems/vatCategory[]      {vat, saleDocument, modifyingDocument}
total                               FixedDecimal212Type, 2 fraction digits
numberOfSaleDocument                CountType = integer 0..9999999
numberOfModifyingDocument           CountType
```

`ReceiptVatCategoryRowType` is `{ vat, saleDocument, modifyingDocument }` in
that order, where `saleDocument` is `PositiveFixedDecimal112Type` (≥0, 2
decimals) and `modifyingDocument` is `FixedDecimal112Type` (may be negative).
The XSD documents both as *bruttó összeg* per VAT group — **gross**, not the
net/VAT/gross triple we send today.

`CreateReceiptResponseType` carries `<id>` of `ReceiptIdentifierType` =
`[0-9]{8}_[0-9]{8}_[0-9]+`. `BaseResultType` carries `resultCode` and an
optional `message`.

**Three corrections to the 2026-09-16 plan, each verified in the XSD:**

1. **`requestId` has two different shapes.** `AuthTokenRequest` extends
   `ntcaAuth:LegacyAuthRequestType` → `ntcaService:LegacyBaseRequestType` →
   `LegacyContextType`, whose `requestId` is `LegacyRequestIdType`,
   pattern `[+a-zA-Z0-9_]{1,30}`. **A `randomUUID()` is invalid there** — it
   contains `-` and is 36 chars. Business requests extend `BaseRequestType` →
   `ContextType`, whose `requestId` is `GenericIdType` = `UuidType`, so
   `randomUUID()` **is** correct there. Two generators, not one.
2. **Timestamp precision differs too.** `LegacyContextType.timestamp` is
   `GenericTimestampMilliType` (`(\.\d{1,3})?Z`); `ContextType.timestamp` is
   `GenericTimestampNanoType` (`(\.\d{1,9})?Z`). `new Date().toISOString()`
   satisfies both — but the current `utcTimestamp()` helper strips the
   milliseconds, so keep the full ISO string.
3. **`exchangeRate` is bounded `1 ≤ rate ≤ 1000`, 4 fraction digits.** We
   have no exchange rate stored for receipts at all (`db/schema.ts` `receipt`
   has `currency` but no rate column), so a non-HUF day cannot be reported
   honestly. See §1.3.

Also verified: `passwordHash` and `requestSignature` are `ntcaType:CryptoType`
— a string with a **required `cryptoType` attribute**. `IssuingSoftwareType`
has exactly one child, `name` — so the registered *software name* is what
`CreateReceiptRequest` carries, and `company.navReceiptSoftwareId` can hold it
with no schema change.

The **VAT category names** are *not* in the XSD — `VatCategoryNameType` is
only a pattern (`[A-Za-z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ% ]*`, ≤50). The authoritative
list comes from `GET /vat-category/list` and from spec §5.9, neither of which
this planning pass could read. Treat the constant as **unverified** — see
OQ-1 in §8.

### 1.3 Non-HUF receipts: refuse, do not guess

`exchangeRate` is required (nillable) on every `CreateReceiptRequest`, and
InvoHub stores no rate on `receipt`. Inventing one would put a wrong figure
into a mandatory NAV filing. So: **HUF groups report with
`<exchangeRate xsi:nil="true"/>`; a non-HUF group is not reported at all** —
it comes back as a blocked group with reason `missing_exchange_rate`, the
submission row is written `failed` with a clear Hungarian message, and the EV
sees that message on the receipt. The additive `receipt.exchangeRate` column
that would unblock it is a follow-up item (§9), not this slice.

---

## 2. Acceptance criteria (numbered, testable)

1. `NavReceiptEnvironment` is `"demo" | "test" | "production"`;
   `parseNavReceiptEnvironment(v)` returns `"demo"` for anything
   unrecognized, `"test"` for `"test"`, and `"demo"` (not `"production"`) for
   `"production"` unless `NAV_PRODUCTION_ENABLED === "true"` — mirroring
   `lib/nav/environment.ts`.
2. `getReceiptBaseUrl("test")` returns
   `https://bv-receipt-if.enyugta.nav.gov.hu/v1`; `getReceiptBaseUrl("demo")`
   returns `""`; `getReceiptBaseUrl("production")` **throws** — InvoHub has no
   verified production host and must never call one.
3. `buildReceiptRequestSignature({ requestId, timestamp, signKey })` delegates
   to `lib/nav/crypto.ts` `buildRequestSignature` (assert by spying/importing,
   not by re-deriving SHA3), returns 128 uppercase hex chars, and changes when
   any one input changes.
4. `newAuthRequestId()` always matches `/^[+A-Za-z0-9_]{1,30}$/`; over 100
   calls it never repeats and never emits `-`. `newServiceRequestId()` matches
   the RFC-4122 UUID shape.
5. `toTaxpayerId()` returns `"12345678"` for `"12345678-1-42"`,
   `"12345678142"`, `"12345678 1 42"` and `"12345678"`, and throws for a value
   with fewer than 8 leading digits. The value emitted in `<taxPayerId>`
   always matches `/^[0-9]{8}$/`.
6. `buildAuthTokenXml(credentials)` emits root `<AuthTokenRequest>` in
   namespace `http://schemas.nav.gov.hu/NTCA/1.0/receipt`, children in order
   `context` → `auth` → `requestVersion` → `headerVersion`, `auth` children in
   order `login`, `passwordHash`, `taxNumber`, `requestSignature`,
   `passwordHash` carrying `cryptoType="SHA-512"` and `requestSignature`
   carrying `cryptoType="SHA3-512"` (both 128 uppercase hex chars), and a
   `context/requestId` matching the legacy pattern of AC 4. The string
   `TokenExchangeRequest` appears nowhere under `lib/nav-receipt/`.
7. `buildCreateReceiptXml(report)` emits root `<CreateReceiptRequest>` with
   children in exactly the §1.2 sequence order (assert on the relative index
   of each child tag in the string), one `<vatCategory>` per category with
   `vat` → `saleDocument` → `modifyingDocument` in that order, and no
   `netAmount`, `vatAmount`, `grossAmount`, `vatRateCode`, `cancelledCount`,
   `startReceiptNumber` or `endReceiptNumber` element anywhere.
8. `buildCreateReceiptXml` emits `<exchangeRate xsi:nil="true"/>` with the
   `xsi` namespace declared for a HUF report, and refuses (throws) if asked to
   build a report whose currency is not `HUF` — non-HUF never reaches the
   builder (§1.3).
9. `buildCreateReceiptXml` escapes `&`, `<`, `>` in the issuing-software name
   and serial number, and emits `total`, `saleDocument` and
   `modifyingDocument` with exactly 2 decimal places.
10. `toNavVatCategory(vatRate, { vatExempt })` returns the AAM category name
    when `vatExempt` is true at any rate, the matching rate name for 0/5/18/27
    otherwise, and the catch-all name for any other rate. Every value it can
    return matches `VatCategoryNameType`'s pattern and is ≤50 chars, and every
    value comes from the single exported `NAV_VAT_CATEGORIES` constant — no
    string literal elsewhere.
11. `buildDailyReceiptReports(receipts, opts)` returns
    `{ reports, blocked }`, grouping by currency; each HUF report has
    `vatCategoryItems` holding **gross** sums per NAV category, `total` equal
    to the sum of all categories' `saleDocument + modifyingDocument`,
    `numberOfSaleDocument` equal to that group's receipt count,
    `numberOfModifyingDocument` `0`, `serialNumber` equal to the lowest
    receipt number in the group, and every amount rounded to 2 decimals.
12. `buildDailyReceiptReports` puts every non-HUF currency group into
    `blocked` with `reason: "missing_exchange_rate"` and produces no report
    for it; a day with no receipts returns `{ reports: [], blocked: [] }`; no
    report is ever produced with both count fields `0`.
13. `parseNavReceiptResponse(xml)` reads `resultCode`, `message` and a named
    child **through a namespace prefix** — it returns `"OK"` for both
    `<resultCode>OK</resultCode>` and `<ns2:resultCode>OK</ns2:resultCode>`,
    and returns `undefined` rather than throwing on unparseable input.
14. `authenticate()` posts the auth XML to `<base>/auth/token` with
    `Content-Type: application/xml`, parses `<token>`/`<validTo>` from the XML
    response, expires the cache entry from `validTo`, and caches per
    `(env, taxNumber, technicalUser)` — the existing cross-company cache test
    in `auth.test.ts` still passes.
15. `authenticate()` rejects with NAV's `resultCode` + `message` text when the
    response is an error, and with the HTTP status plus a truncated body when
    the body is not parseable XML. It makes no call at all in `demo`.
16. `submitReceiptDataReport()` posts to `<base>/receipt/create` with
    `Authorization: Bearer <token>` and returns
    `{ ok: true, reportId: "12345678_20260712_3" }` parsed from `<id>`; on a
    NAV error it returns `{ ok: false, error }` containing NAV's `message`
    text and performs **no** retry.
17. `POST /api/receipts/:id/submit-nav` in `demo` mode makes **zero** `fetch`
    calls and still records a submission row (unchanged behaviour). In `test`
    mode it calls `submitReceiptDataReport` once per reportable currency
    group, stores NAV's `id` in `navReceiptSubmission.transactionId`, and
    stores NAV's error text — or the blocked-group message — in
    `errorMessage`.
18. `GET /api/cron/nav-receipt-report` still skips `demo` companies, and for a
    `test` company with a HUF day plus a EUR day writes a `submitted` row for
    HUF and a `failed` row carrying the missing-exchange-rate message for EUR.
19. The receipt detail screen's NAV card shows a mode chip (`Demó` /
    `NAV teszt`), the mode hint, the NAV report id when one exists, and the
    NAV error text when the last submission failed. Every string comes from
    `t(...)` and exists in both `hu.ts` and `en.ts`; `lib/i18n/locales/en.test.ts`
    (key parity) stays green.
20. `npm run typecheck` and `npm run test:unit` are green.

---

## 3. Files to touch

Rewrite, in `lib/nav-receipt/`:

- `environment.ts` — three modes, demo default, `production` throws.
- `types.ts` — `DailyReceiptReport` reshaped to the XSD (`taxPayerId`,
  `issuingSoftwareName`, `applicableDate`, `serialNumber`, `currency`,
  `exchangeRate: number | null`, `vatCategoryItems`, `total`,
  `numberOfSaleDocument`, `numberOfModifyingDocument`); result type gains
  `reportId` and drops `transactionId`; delete `VatRateAggregation`.
- `xml-builder.ts` — `buildAuthTokenXml`, `buildCreateReceiptXml`. Delete the
  three invented builders.
- `auth.ts` — XML request, XML response, real signature, `validTo` expiry.
- `report.ts` — `submitReceiptDataReport` only. Delete `queryReceiptReport`
  and `registerReceiptSoftware` (slices 2 and 3, §9).
- `index.ts` — re-exports.

New:

- `lib/nav-receipt/signature.ts` — thin wrapper over `lib/nav/crypto.ts`, plus
  `newAuthRequestId()` / `newServiceRequestId()`.
- `lib/nav-receipt/taxpayer.ts` — `toTaxpayerId()`.
- `lib/nav-receipt/vat-category.ts` — `NAV_VAT_CATEGORIES` + `toNavVatCategory()`.
- `lib/nav-receipt/response.ts` — `parseNavReceiptResponse()`, prefix-tolerant,
  in the style of `lib/nav/xml-utils.ts`. **No new XML-parser dependency.**
- `lib/receipts/daily-report.ts` — `buildDailyReceiptReports()`.

Wire up:

- `app/api/receipts/[id]/submit-nav+api.ts`
- `app/api/cron/nav-receipt-report+api.ts`
- `app/(app)/receipts/[id]/index.tsx` (NAV card)
- `lib/i18n/locales/hu.ts`, `lib/i18n/locales/en.ts`
- `docs/nav-test-setup.md` — a short "NAV eNyugta (nyugta-adatszolgáltatás)"
  section: env vars, the test host, that production is unreachable, and that
  `/issuing-software/create` is a one-time manual operator step for now.

**Do not touch** `lib/nav/` (OSA invoice reporting), `lib/m2m/`,
`db/schema.ts`, or `marketing/`.

---

## 4. Tests to write first (TDD)

Write each test and watch it fail before implementing. Mock `global.fetch`
everywhere; no test may reach the network.

1. `lib/nav-receipt/environment.test.ts` (rewrite) — AC 1, 2, including the
   `production` → `demo` downgrade and the `getReceiptBaseUrl("production")`
   throw.
2. `lib/nav-receipt/signature.test.ts` (new) — AC 3, 4.
3. `lib/nav-receipt/taxpayer.test.ts` (new) — AC 5.
4. `lib/nav-receipt/vat-category.test.ts` (new) — AC 10.
5. `lib/nav-receipt/xml-builder.test.ts` (rewrite) — AC 6, 7, 8, 9, with the
   element-order assertions done on `indexOf` of each child tag.
6. `lib/nav-receipt/response.test.ts` (new) — AC 13, including the
   `ns2:`-prefixed case and a garbage-input case.
7. `lib/receipts/daily-report.test.ts` (new) — AC 11, 12: a mixed-rate HUF
   day, an AAM company's day, a HUF+EUR day (one report, one blocked), an
   empty day, and 2-decimal rounding.
8. `lib/nav-receipt/auth.test.ts` (rewrite, **keep** the existing
   cross-company cache case) — AC 14, 15.
9. `lib/nav-receipt/report.test.ts` (rewrite) — AC 16, asserting the URL ends
   in `/receipt/create`, the `Authorization` header, and the parsed id.
10. `__tests__/api/receipts/submit-nav.test.ts` (extend) — AC 17.
11. `__tests__/api/cron/nav-receipt-report.test.ts` (extend) — AC 18.
12. `lib/i18n/locales/en.test.ts` already guards hu/en parity — the new keys
    must keep it green (AC 19).

---

## 5. i18n keys (hu + en)

Added under `receipts.` in both `lib/i18n/locales/hu.ts` and `en.ts`:

| Key | hu | en |
|-----|----|----|
| `receipts.navReportId` | `NAV adatszolgáltatás azonosító` | `NAV report ID` |
| `receipts.navReportError` | `NAV hibaüzenet` | `NAV error` |
| `receipts.navModeDemo` | `Demó` | `Demo` |
| `receipts.navModeTest` | `NAV teszt` | `NAV test` |
| `receipts.navDemoHint` | `Demó mód: a nyugta nem kerül be a NAV rendszerébe.` | `Demo mode: this receipt is not sent to NAV.` |
| `receipts.navTestHint` | `A napi nyugta-adatszolgáltatás a NAV teszt rendszerébe kerül.` | `The daily receipt data report is sent to NAV's test system.` |
| `receipts.navMissingExchangeRate` | `Nem HUF nyugta: hiányzik az árfolyam, ezért nem küldhető be a NAV-nak.` | `Non-HUF receipt: no exchange rate on file, so it cannot be reported to NAV.` |

**Delete** `receipts.navSubmissionHint` from both locale files. It reads
"A nyugta automatikusan beküldésre kerül a NAV eNyugta rendszerébe." — a
present-tense compliance claim that is false in demo mode (the default) and
was false in every mode before this slice. It is currently referenced by
nothing but the locale files, so deleting it is safe; the mode-aware
`navDemoHint` / `navTestHint` pair replaces it on the detail screen.

No marketing copy changes in this slice.

---

## 6. db/schema.ts changes

**NONE — no additive and no destructive change.** No table, column, index or
enum is added, altered or dropped, so the Ship phase runs no `db:push` for
this slice.

`navReceiptSubmission` already holds everything written here: `transactionId`
(now carries NAV's `id`), `errorMessage`, `status`, `reportDate`,
`receiptCount`, `vatBreakdown`. Two rows for one `reportDate` (the
two-currency case) are already legal — there is no unique constraint on
`(userId, reportDate)`. `company.navReceiptSoftwareId` already exists and
carries the registered issuing-software *name*.

Two **ADDITIVE** follow-ups are deliberately deferred to their own items
(§9): `receipt.exchangeRate` (numeric, nullable) and
`navReceiptSubmission.currency` (text, nullable).

---

## 7. UX notes

**Mobile (375px)** — `app/(app)/receipts/[id]/index.tsx`, the NAV card:

- Row 1 stays as today: `NAV` label + the submitted/pending badge.
- Row 2: the mode chip (`Demó` / `NAV teszt`) and the matching hint at
  `size="xs"` in `text-muted-foreground`. The hint wraps; it is never
  truncated.
- Row 3, when a report id exists: label/value in the same
  `HStack justify-between` pattern as the rows above. The id
  (`12345678_20260712_3`) is 20+ chars, so give the value
  `className="flex-1 text-right font-mono text-xs"` plus `selectable`, and let
  it wrap instead of setting `numberOfLines`.
- Row 4, when the last submission failed: `navReportError` with NAV's message
  in `text-destructive`, `size="xs"`, wrapping over multiple lines. NAV error
  texts are long Hungarian sentences — this is the row most likely to break
  375px, so verify it with a ~120-character message.
- No manual "submit to NAV" button in this slice; the existing
  `POST /api/receipts/:id/submit-nav` call site is unchanged.

**Desktop (≥768px)**: the same card inside `ScreenLayout`'s content column.
No new route, no sidebar entry, no notification-panel entry. The receipts
list badge in `app/(app)/receipts/index.tsx` stays exactly as it is — no
per-row error text in a list.

**Both**: per AGENTS.md §1/§3 use `className` only, never `style` arrays, and
change nothing about `FlatList`/`ListEmptyComponent`.

---

## 8. Risk classification

**Risk: `tax-legal`.**

Reason: this slice decides what an egyéni vállalkozó's mandatory
nyugta-adatszolgáltatás actually reports to NAV — which VAT category each
forint lands in (including the AAM mapping for alanyi adómentes EVs), how
per-day gross totals are aggregated, and which days are reported at all.
Those are Áfa tv. / NAV-spec questions, not code-style choices, and the queue
entry already marks the item "(needs tax/legal sign-off)". Per CLAUDE.md this
becomes a **pull request for human sign-off** — Ship must not auto-merge and
must not auto-deploy it.

NAV-production safety: this slice makes the receipt path strictly safer than
today. `resolveReceiptEnvironment()` currently has no demo mode at all and
honours `NAV_RECEIPT_ENV=production` with no kill switch. After this slice
`parseNavReceiptEnvironment()` downgrades `production` to `demo` unless
`NAV_PRODUCTION_ENABLED === "true"`, **and** `getReceiptBaseUrl("production")`
throws, because InvoHub has no verified production host and must never
acquire one by guesswork. No credential is invented or committed. No test
touches the network.

Open questions for the human sign-off — **do not resolve these in code**:

- **OQ-1 (blocking for real use).** The VAT category **names** could not be
  verified from the public repo — `VatCategoryNameType` is only a pattern, and
  the authoritative list lives in spec §5.9 and behind
  `GET /vat-category/list`. `NAV_VAT_CATEGORIES` must therefore ship as a
  single constant with a source comment and a `TODO` pointing at
  `/vat-category/list`, and the reviewer must confirm each name against the
  spec before merge. Do **not** scatter these strings through the codebase.
- **OQ-2.** Does a 0%-VAT receipt line issued by a *non*-AAM EV belong in the
  `0%` category or the catch-all? This plan maps it to `0%`.
- **OQ-3.** `numberOfSaleDocument` is the *receipt* count for the currency
  group. Confirm NAV counts nyugta documents, not line items.
- **OQ-4.** `serialNumber` is the lowest receipt number in the group
  (`NYG-2026-001`). Confirm NAV expects the first number of the reported range
  and that an InvoHub receipt number is the right value to send.
- **OQ-5.** Storno/helyesbítő nyugta does not exist in InvoHub, so
  `numberOfModifyingDocument` is always `0` and `modifyingDocument` always
  `0.00`. Confirm that is acceptable until slice 3.
- **OQ-6.** Refusing to report non-HUF receipt days (§1.3) is the conservative
  choice. Confirm that refusing is preferable to reporting with an MNB rate we
  would have to fetch and store.

---

## 9. Out of scope (explicitly)

- `/receipt/list` and `/receipt/detail` — reading reports back from NAV, and
  surfacing submission history in the UI (**slice 2**).
- `/receipt/modify` and `/receipt/invalidate` — storno/helyesbítő nyugta
  (**slice 3**; InvoHub has no receipt cancellation feature at all yet).
- `/issuing-software/create` and `/issuing-software/list`. Registration stays
  a one-time manual operator step, documented in `docs/nav-test-setup.md`;
  `registerReceiptSoftware()` is deleted rather than rebuilt.
- Live `/vat-category/list` and `/currency/list` lookups and caching — the
  category list is a constant with a sourced TODO (OQ-1).
- Any `db/schema.ts` change, including the two additive columns named in §6.
  File `receipt.exchangeRate` as its own backlog item — it is what unblocks
  non-HUF receipt reporting (§1.3).
- Any real network call against NAV: no live smoke test, no
  `scripts/nyugta-check.mjs` (that belongs with slice 2, once read-back
  exists).
- Any production NAV mode, host, credential, or `NAV_PRODUCTION_ENABLED` flip.
- `marketing/` — it must not gain any e-nyugta claim from this slice. The
  feature is not certified end-to-end until slices 2–3 and the tax/legal
  sign-off land.
- A manual "submit to NAV now" button, receipt cancellation UI, and the
  `receipts.navSubmission*` settings surface.
