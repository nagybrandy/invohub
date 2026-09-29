// docs/plans/2026-09-16-e-nyugta-nav-receipt-api.md
# Plan — e-nyugta: rebuild the NAV eRECEIPT client against the real published interface (slice 1 of 3)

- Backlog item: Phase 1 — Core invoicing, NAV-compliant. Owner priority #7
  ("e-nyugta: real NAV eRECEIPT API … behind demo/test modes — big item, plan
  it in slices") and the matching detailed entry under "Remaining for the
  launch gate".
- Slug: `e-nyugta-nav-receipt-api`
- Branch: `slice/e-nyugta-nav-receipt-api`
- Date: 2026-09-16
- Risk: **tax-legal** (see §8) — ships as a **pull request for human sign-off**,
  must **not** auto-merge and must **not** auto-deploy.

---

## 1. Goal and user value

Today `lib/nav-receipt/` talks to an interface that **does not exist**. It
posts to `https://api-test.onlineszamla.nav.gov.hu/receipt-if/v1` with
namespaces (`http://schemas.nav.gov.hu/receipt/1.0/api`), root elements
(`TokenExchangeRequest`, `ReceiptDataReportRequest`,
`SoftwareRegistrationRequest`) and fields (`netAmount`, `vatAmount`,
`grossAmount`, `startReceiptNumber`, `endReceiptNumber`, `cancelledCount`,
`vatRateCode`) that were invented in `lib/nav-receipt/xml-builder.ts`. The auth
call in `lib/nav-receipt/auth.ts` posts **JSON**, not XML, and computes no
request signature at all. Every "NAV teszt" receipt submission an EV makes
today fails at the network or is rejected — and the receipt detail screen
happily shows "Nincs beküldve" with no explanation.

Nyugta-adatszolgáltatás has been mandatory since **2026-09-01** and NAV only
waives penalties through the end of 2026. For an EV who issues nyugta, this is
a hard launch blocker.

**After this slice the EV gets:** a receipt data report that is actually built
against NAV's published schema and signed the way NAV's published spec
requires, sent to NAV's real test host; a NAV-issued report id stored and
shown on the receipt; and, when NAV rejects the report, the real Hungarian NAV
error text on screen instead of a silent "not submitted" badge. Demo mode
stays the default and stays a local simulation — no EV needs a NAV account to
use InvoHub.

### 1.1 The published interface (verified 2026-09-16, not from memory)

Fetched from `github.com/nav-gov-hu/eRECEIPT` (default branch `master`) on
2026-09-16:

- Spec: `docs/specification/NAV_Nyugta_adatszolgaltatas_IF_specifikacio_v1.3.pdf`
  (the backlog names v1.2; **v1.3 is now the published latest** — pin to v1.3).
- Schema: `xsd/1.1/receipt_datareport/receipt-if-schema-v1.1.1.xsd`
  (the backlog names v1.1; 1.1.1 is identical for everything this slice sends
  except a **widened** `ReceiptSerialNumberType` pattern — pin to 1.1.1).
- Common schemas: `nav-gov-hu/Common`, tag `common-2.0.0-rc.2`
  (`NTCA/2.0/common/{service,authservice,type,string,customer}.xsd`).

**Endpoints** (spec §"Elérhetőségek"):

| Mode | Base |
|------|------|
| test | `https://bv-receipt-if.enyugta.nav.gov.hu/v1` |
| production | `https://receipt-if.enyugta.nav.gov.hu/v1` (never called; see §8) |

Operations, all `POST`, all XML in / XML out:
`/auth/token`, `/receipt/create`, `/receipt/modify`, `/receipt/invalidate`,
`/receipt/list`, `/receipt/detail`, `/issuing-software/create`,
`/issuing-software/list`, `/vat-category/list`, `/currency/list`.

**Auth** (spec §1.2, §2.1.1): business endpoints use JWT. `POST /auth/token`
returns a token; every other call sends `Authorization: Bearer <token>`. The
token is per-taxpayer and valid until the `validTo` timestamp in the response.

**`requestSignature`** (spec §2.1.1.1, page 14) — concatenate, in order:

1. the `requestId` value,
2. the `timestamp` value formatted `yyyyMMddHHmmss` in **UTC**,
3. the technical user's signing key, literal;

then **SHA3-512, uppercase hex**. The tag carries a required
`cryptoType="SHA3-512"` attribute. `passwordHash` is uppercase **SHA-512**
with `cryptoType="SHA-512"`.

This is exactly the formula `lib/nav/crypto.ts` already implements for OSA
(`buildRequestSignature` with no invoice operations) — **reuse it, do not
write a second one.** The spec publishes a worked example, which becomes our
golden fixture (verified to match `crypto.createHash("sha3-512")` on
2026-09-16):

```
requestId  DPrHL3Tr6djsrPt
timestamp  2026-08-24T06:50:53.000Z
signKey    ce-8f5e-215119fa7dd621DLMRHRLH2S
base       DPrHL3Tr6djsrPt20260824065053ce-8f5e-215119fa7dd621DLMRHRLH2S
signature  2FD464BE4D01BE6BB72A30E9AD864BB433D3D253BEFA9FA921316075A1341844
           567CFBC7CBAEB9E20E4723F583DB8962F46054F928FB203EFC6467B77B969625
```

**`AuthTokenRequest`** — root in `http://schemas.nav.gov.hu/NTCA/1.0/receipt`,
extends `ntcaAuth:LegacyAuthRequestType`. Child order (spec §5.1 sample):
`srv:context{requestId,timestamp}`, `auth:auth{login, passwordHash,
taxNumber, [predecessorTaxNumber], requestSignature}`, `auth:requestVersion`,
`auth:headerVersion`. `LegacyContextType` timestamps are millisecond
precision (`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z`).
Response: `<token>` + `<validTo>`.

**`CreateReceiptRequest`** — extends `ntcaService:BaseRequestType`, whose
`context` uses **nanosecond-capable** timestamps
(`(\.\d{1,9})?Z` — our millisecond ISO string is valid) and a **UUID**
`requestId`. Child order is fixed by the XSD sequence:

```
s:context{requestId,timestamp}
taxPayerId                 8-digit törzsszám, [0-9]{8}
issuingSoftware/name       must already be registered via /issuing-software/create
applicableDate             yyyy-MM-dd, must not be in the future
serialNumber               first receipt number of the report
currency                   only values offered by /currency/list
exchangeRate               nillable — xsi:nil="true" or 1 for HUF; max 4 decimals
vatCategoryItems/vatCategory[]{vat, saleDocument, modifyingDocument}
total                      sum of all categories' gross, max 2 decimals
numberOfSaleDocument
numberOfModifyingDocument
```

Response: `resultCode` + `<id>` shaped `[0-9]{8}_[0-9]{8}_[0-9]+`
(e.g. `12345678_20260712_3`).

**This is the single biggest correctness gap.** NAV wants **gross totals per
VAT category**, not the net/VAT/gross triple we currently send, and the
category is a **name string** from `/vat-category/list`, not a rate code. The
published category list (spec §5.9 sample, valid from 2026-09-01) is:

`0%`, `5%`, `18%`, `27%`, `Alanyi adómentes`, `Egyéb`

So an **AAM (alanyi adómentes) EV** — the single most common InvoHub user —
must report under `Alanyi adómentes`, **not** `0%`. `company.vatExempt`
already exists in `db/schema.ts` and is what decides this.

Business rules from spec §2.1.4: `saleDocument` ≥ 0; `modifyingDocument` may
be negative; **at least one** of `numberOfSaleDocument` /
`numberOfModifyingDocument` must be non-zero; `currency` is per-report, so a
day that mixes HUF and EUR receipts needs **one report per currency**.

---

## 2. Acceptance criteria (numbered, testable)

1. `getReceiptBaseUrl("test")` returns `https://bv-receipt-if.enyugta.nav.gov.hu/v1`
   and `getReceiptBaseUrl("production")` returns
   `https://receipt-if.enyugta.nav.gov.hu/v1`; `"demo"` returns `""`.
2. `NavReceiptEnvironment` is `"demo" | "test" | "production"`,
   `parseNavReceiptEnvironment()` defaults to `"demo"` for anything
   unrecognized, and returns `"demo"` (not `"production"`) when the stored
   value is `"production"` and `NAV_PRODUCTION_ENABLED !== "true"` — mirroring
   `lib/nav/environment.ts`.
3. `buildReceiptRequestSignature({requestId, timestamp, signKey})` reproduces
   the spec's published vector exactly (§1.1), and is implemented by
   delegating to `lib/nav/crypto.ts` rather than re-deriving SHA3.
4. `buildAuthTokenXml()` emits root `<AuthTokenRequest>` in namespace
   `http://schemas.nav.gov.hu/NTCA/1.0/receipt`, with `srv:context` before
   `auth:auth`, `passwordHash` carrying `cryptoType="SHA-512"` and 128
   uppercase hex chars, `requestSignature` carrying `cryptoType="SHA3-512"`
   and 128 uppercase hex chars, and `requestVersion`/`headerVersion` last.
   The string `TokenExchangeRequest` appears nowhere in `lib/nav-receipt/`.
5. `buildCreateReceiptXml(report)` emits root `<CreateReceiptRequest>` with
   children in exactly the XSD sequence order of §1.1, one `<vatCategory>` per
   category with `vat`/`saleDocument`/`modifyingDocument` in that order, and
   no `netAmount`/`vatAmount`/`grossAmount`/`vatRateCode`/`cancelledCount`/
   `startReceiptNumber`/`endReceiptNumber` element anywhere.
6. For a HUF report `buildCreateReceiptXml` emits
   `<exchangeRate xsi:nil="true"/>` (with the `xsi` namespace declared); for a
   non-HUF report it emits the numeric rate with at most 4 decimals.
7. `toNavVatCategory(vatRate, { vatExempt })` returns `"Alanyi adómentes"`
   when `vatExempt` is true (any rate), and otherwise `"0%"`, `"5%"`, `"18%"`,
   `"27%"` for those rates; any other rate returns `"Egyéb"`. No other string
   is ever emitted into `<vat>`.
8. `buildDailyReceiptReports(receipts, opts)` returns **one report per
   currency** present in the day's receipts, each with: `vatCategoryItems`
   holding **gross** sums per NAV category, `total` equal to the sum of all
   categories' `saleDocument + modifyingDocument`, `numberOfSaleDocument`
   equal to the receipt count for that currency, `numberOfModifyingDocument`
   `0`, `serialNumber` equal to the lowest receipt number in that group, and
   amounts rounded to 2 decimals.
9. `buildDailyReceiptReports` returns `[]` for a day with no receipts, and
   never produces a report where both count fields are `0`.
10. `authenticate()` posts the auth XML to `<base>/auth/token` with
    `Content-Type: application/xml`, parses `<token>`/`<validTo>` from the XML
    response, and caches per `(env, taxNumber, technicalUser)` — the existing
    cross-company cache test in `auth.test.ts` still passes.
11. `authenticate()` rejects with the NAV `resultCode` + `message` text when
    the response carries `resultCode` `ERROR`, and with the HTTP status when
    the body is not parseable XML.
12. `submitReceiptDataReport()` posts to `<base>/receipt/create` with
    `Authorization: Bearer <token>`, and on success returns
    `{ ok: true, reportId: "12345678_20260712_3" }` parsed from `<id>`.
13. On a NAV error response `submitReceiptDataReport()` returns
    `{ ok: false, error }` where `error` contains NAV's `message` text, and
    performs **no** retry.
14. `POST /api/receipts/:id/submit-nav` in `demo` mode makes **zero** network
    calls and still records a submission row (unchanged behaviour), and in
    `test` mode calls `submitReceiptDataReport` once per currency group and
    stores NAV's `id` in `navReceiptSubmission.transactionId` and NAV's error
    text in `errorMessage`.
15. `GET /api/cron/nav-receipt-report` skips `demo` companies, and for a
    `test` company with receipts in two currencies creates two submission rows
    for the same `reportDate`.
16. The receipt detail screen shows, under the NAV card: the NAV report id
    when submitted, the NAV error text when the last submission failed, and a
    mode chip (`Demó` / `NAV teszt`). All strings come from `t(...)` and exist
    in both `hu.ts` and `en.ts`.
17. `npm run typecheck` and `npm run test:unit` are green.

---

## 3. Files to touch

Rewrite (in `lib/nav-receipt/`):

- `environment.ts` — three modes, real hosts, production kill switch.
- `types.ts` — `DailyReceiptReport` reshaped to the XSD
  (`taxPayerId`, `issuingSoftwareName`, `applicableDate`, `serialNumber`,
  `currency`, `exchangeRate: number | null`, `vatCategoryItems`, `total`,
  `numberOfSaleDocument`, `numberOfModifyingDocument`); result type gains
  `reportId`, drops `transactionId`.
- `xml-builder.ts` — `buildAuthTokenXml`, `buildCreateReceiptXml`,
  `buildCreateIssuingSoftwareXml`. Delete the three invented builders.
- `auth.ts` — XML request, XML response, signature, `validTo` expiry.
- `report.ts` — `submitReceiptDataReport`, `registerIssuingSoftware`. Delete
  `queryReceiptReport` (the `/receipt/list` + `/receipt/detail` rebuild is
  slice 2 — see §9).
- `index.ts` — re-exports.

New:

- `lib/nav-receipt/signature.ts` — thin wrapper over `lib/nav/crypto.ts`.
- `lib/nav-receipt/vat-category.ts` — rate + `vatExempt` → NAV category name.
- `lib/nav-receipt/response.ts` — `parseNavReceiptResponse(xml)` →
  `{ resultCode, message, values }` (small regex/`xml-utils` reader, in the
  style of `lib/nav/xml-utils.ts`; do **not** add an XML parser dependency).
- `lib/receipts/daily-report.ts` — `buildDailyReceiptReports(receipts, opts)`,
  the pure per-currency/per-category gross aggregation.

Wire up:

- `app/api/receipts/[id]/submit-nav+api.ts`
- `app/api/cron/nav-receipt-report+api.ts`
- `app/(app)/receipts/[id]/index.tsx` (NAV card)
- `lib/i18n/locales/hu.ts`, `lib/i18n/locales/en.ts`
- `docs/nav-test-setup.md` — a short "NAV eNyugta (nyugta-adatszolgáltatás)"
  section: which env vars, which host, and that production is off.

**Do not touch** `lib/nav/` (OSA invoice reporting), `lib/m2m/`,
`db/schema.ts`, or `marketing/`.

---

## 4. Tests to write first (TDD)

Write these before any implementation; each maps to the criteria in §2.

1. `lib/nav-receipt/signature.test.ts` — the spec's published golden vector
   (AC 3), plus that a one-character change in the sign key changes the hash.
2. `lib/nav-receipt/environment.test.ts` (rewrite) — AC 1, AC 2, including the
   `production` → `demo` downgrade when `NAV_PRODUCTION_ENABLED` is unset.
3. `lib/nav-receipt/vat-category.test.ts` — AC 7, each rate plus the
   `vatExempt` override plus an unknown rate → `Egyéb`.
4. `lib/nav-receipt/xml-builder.test.ts` (rewrite) — AC 4, 5, 6, plus XML
   escaping of the software name and serial number, plus an explicit assertion
   that element order matches the XSD sequence (assert on indexes of the child
   tags within the string).
5. `lib/receipts/daily-report.test.ts` — AC 8, 9: a mixed-rate HUF day, an
   AAM company's day, a day mixing HUF and EUR receipts producing two reports,
   an empty day, and 2-decimal rounding.
6. `lib/nav-receipt/auth.test.ts` (rewrite, keep the existing cross-company
   cache case) — AC 10, 11, with `global.fetch` mocked to return XML.
7. `lib/nav-receipt/report.test.ts` (rewrite) — AC 12, 13, asserting the URL
   ends in `/receipt/create`, the `Authorization` header, and the parsed id.
8. `__tests__/api/receipts/submit-nav.test.ts` (extend) — AC 14: demo makes no
   `fetch` call; test mode stores NAV's id and error text.
9. `__tests__/api/cron/nav-receipt-report.test.ts` (extend) — AC 15.
10. `lib/i18n/locales/en.test.ts` already guards hu/en key parity — the new
    keys must keep it green (AC 16).

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

Also **change** the existing `receipts.navSubmissionHint` — today it reads
"A nyugta automatikusan beküldésre kerül a NAV eNyugta rendszerébe.", which is
a present-tense compliance claim that is false in demo mode (the default) and
was false in every mode before this slice. Replace its use on the detail
screen with the mode-aware `navDemoHint` / `navTestHint` pair above and delete
the key.

No marketing copy changes in this slice.

---

## 6. db/schema.ts changes

**NONE.** No table, column, index, or enum is added, altered, or dropped.

`navReceiptSubmission` already has everything this slice writes:
`transactionId` (now holds NAV's `id`), `errorMessage`, `status`,
`reportDate`, `receiptCount`, `vatBreakdown`. Two rows for one `reportDate`
(the two-currency case) are already legal — there is no unique constraint on
`(userId, reportDate)`.

A `currency` column on `navReceiptSubmission` would be a nice **ADDITIVE**
follow-up so the UI can label which report is which; it is deliberately
**out of scope** here (see §9) to keep this slice schema-free.

---

## 7. UX notes

**Mobile (375px)** — `app/(app)/receipts/[id]/index.tsx`, NAV card:

- Keep the existing one-line `NAV · [badge]` row as the first row.
- Below it, a mode chip (`Demó` / `NAV teszt`) and the hint text at `size="xs"`
  in `text-muted-foreground`; the hint wraps, it is not truncated.
- When a report id exists, add a label/value row using the same
  `HStack justify-between` pattern as the rows above; the id
  (`12345678_20260712_3`, 20+ chars) must not push the label off-screen — give
  the value `className="flex-1 text-right font-mono text-xs"` and
  `selectable`, and let it wrap rather than setting `numberOfLines`.
- When the last submission failed, show `navReportError` with the NAV message
  in `text-destructive`, `size="xs"`, wrapping over multiple lines. NAV error
  texts are long Hungarian sentences — this is the row most likely to break
  the 375px layout, so verify it with a ~120-character message.
- Do not add a manual "submit to NAV" button in this slice; the existing
  `POST /api/receipts/:id/submit-nav` call site stays as it is.

**Desktop (≥768px)**:

- The same card inside `ScreenLayout`'s content column; no new sidebar or
  panel entries, no new route.
- The receipts list badge (`NAV ✓` in `app/(app)/receipts/index.tsx`) stays
  exactly as it is — no per-row error text in a list.

**Both**: per AGENTS.md §1/§3, use `className` only (no `style` arrays), and
no `ListEmptyComponent` changes.

---

## 8. Risk classification

**Risk: `tax-legal`.**

Reason: this slice decides what an egyéni vállalkozó's mandatory
nyugta-adatszolgáltatás actually reports to NAV — which VAT category each
forint lands in (including the `Alanyi adómentes` mapping for AAM EVs), how
per-day totals are aggregated, and how multi-currency days are split. Those
are Áfa tv. / NAV-spec questions, not code-style choices, and the queue entry
already marks the item "(needs tax/legal sign-off)". Per CLAUDE.md this
becomes a **pull request for human sign-off** — Ship must not auto-merge and
must not auto-deploy it.

NAV-production safety: the production host string is added to a lookup table
but is **unreachable by construction** — `parseNavReceiptEnvironment()`
downgrades `production` to `demo` unless `NAV_PRODUCTION_ENABLED === "true"`,
which is `false` in `.env.example` and must stay false. This slice makes the
receipt path *safer* than today, where `resolveReceiptEnvironment()` has no
demo mode at all and honours `NAV_RECEIPT_ENV=production` with no kill switch.
No credential is invented or committed; no production endpoint is called by
code or by tests (all `fetch` is mocked).

Open questions for the human sign-off — **do not resolve these in code**:

- **OQ-1**: does a receipt line at 0% VAT issued by a *non*-AAM EV belong in
  `0%` or in `Egyéb`? This plan maps it to `0%`.
- **OQ-2**: `numberOfSaleDocument` is set to the *receipt* count for the
  currency group. Confirm NAV counts nyugta documents, not line items.
- **OQ-3**: `serialNumber` is the lowest receipt number of the group
  (`NYG-2026-001`). Confirm NAV expects the first number of the reported
  range, and that an InvoHub receipt number is the right thing to send.
- **OQ-4**: storno/helyesbítő nyugta has no representation in InvoHub yet, so
  `numberOfModifyingDocument` is always `0` and `modifyingDocument` always
  `0.00`. Confirm that is acceptable until slice 3.

---

## 9. Out of scope (explicitly)

- `/receipt/list`, `/receipt/detail` — reading reports back from NAV
  (**slice 2**, together with surfacing submission history in the UI).
- `/receipt/modify`, `/receipt/invalidate` — storno/helyesbítő nyugta
  (**slice 3**; InvoHub has no receipt cancellation feature at all yet).
- `/vat-category/list` and `/currency/list` live lookups and caching — this
  slice hardcodes the published 2026-09-01 category list with a source
  comment and a TODO pointing at the endpoint.
- Auto-calling `/issuing-software/create` during submission.
  `registerIssuingSoftware()` exists as a library function and is documented
  in `docs/nav-test-setup.md` as a one-time operator step.
- Any `db/schema.ts` change, including the `navReceiptSubmission.currency`
  column suggested in §6.
- Any real network call against NAV — no live smoke test, no
  `scripts/nyugta-check.mjs` (that belongs with slice 2 once read-back exists).
- Any production NAV mode, credential, or `NAV_PRODUCTION_ENABLED` flip.
- Marketing copy: `marketing/` must not gain any e-nyugta claim from this
  slice; the feature is not certified end-to-end until slices 2–3 and the
  tax/legal sign-off land.
- A manual "submit to NAV now" button, receipt cancellation UI, and the
  `receipts.navSubmission*` settings surface.
