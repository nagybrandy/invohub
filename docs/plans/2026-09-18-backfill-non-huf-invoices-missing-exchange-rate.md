# Plan — backfill-non-huf-invoices-missing-exchange-rate

- **Slug:** `backfill-non-huf-invoices-missing-exchange-rate`
- **Branch (Build phase creates it, in its own worktree):** `slice/backfill-non-huf-invoices-missing-exchange-rate`
- **Base branch:** `main`
- **Phase:** Phase 1 — Core invoicing, NAV-compliant (Prioritás item 10)
- **Backlog item:** `docs/loop-queue.md` Phase 1 item 10
- **Date:** 2026-09-18

---

## 1. Goal and user value

`slice/non-huf-invoice-exchange-rate-nav-xml` fixed the *cause* — `POST /api/invoices`
now persists `body.exchangeRate` (`app/api/invoices+api.ts:96`, `normalizeExchangeRate`)
and `buildNavInvoiceXml` refuses rather than reporting a false HUF VAT base
(`lib/nav/invoice-xml.ts:390-394`). It did not fix the *rows already in the database*.

Today, a Hungarian EV who invoiced in EUR before that fix has invoices with
`currency = 'EUR'` and `exchange_rate IS NULL`. Their experience is:

- Nothing anywhere in the app says those invoices exist or that anything is wrong.
- `POST /api/nav/submit` throws out of `buildNavInvoiceXml` uncaught, so the route's
  `try`-less handler produces an unhandled 500 with an English developer sentence
  ("Cannot build NAV invoice XML for …"). The EV sees a raw failure, not "add the rate".
- The only way to fix one is to guess that the invoice needs editing, open the composer,
  expand the collapsed "Dates/Payment" section, and find the exchange-rate input.

After this change the EV gets: **a count and a list of exactly which invoices are
affected, a one-tap route straight to the exchange-rate field, and a NAV submission
that refuses politely in Hungarian instead of 500-ing.** No rate is ever guessed,
fetched or defaulted — the user types it, exactly as the composer already requires
for new invoices.

**Why this is worth more than the literal checkbox:** the underlying filter
(`currency <> 'HUF' AND exchange_rate missing`) is the same predicate the NAV XML
builder already uses. Exposing it as a list filter means the "which invoices are
broken" question is answered by the same code path that decides whether NAV will
accept them — the listing can never drift from the refusal.

---

## 2. Acceptance criteria (testable, numbered)

**AC1 — one predicate decides "affected"**
1.1 `isMissingExchangeRate({ currency: "HUF", exchangeRate: undefined })` is `false`
    (a HUF invoice never needs a rate — matches `resolveExchangeRate`'s rule that a
    HUF invoice always resolves to 1).
1.2 `isMissingExchangeRate({ currency: "EUR", exchangeRate: undefined })` is `true`.
1.3 `isMissingExchangeRate({ currency: "EUR", exchangeRate: null as never })` is `true`.
1.4 `isMissingExchangeRate({ currency: "EUR", exchangeRate: 0 })` and `{ …, exchangeRate: -3 }`
    are `true` (non-positive is unusable, same as `resolveExchangeRate`'s `"invalid"`).
1.5 `isMissingExchangeRate({ currency: "EUR", exchangeRate: 398.5 })` is `false`.
1.6 The function is implemented **in terms of** `resolveExchangeRate` — it does not
    re-derive the currency/positivity rules. (Assert by behaviour: every `ok: false`
    resolution is `true` here, every `ok: true` is `false`.)

**AC2 — the list API can filter for them**
2.1 `normalizeInvoiceListFilters({ needsExchangeRate: "1" })` → `{ needsExchangeRate: true }`.
2.2 `"true"` also → `true`; `null`, `""`, `"0"`, `"false"`, `"yes"` → `needsExchangeRate` absent/undefined.
2.3 `invoiceMatchesListFilters` with `{ needsExchangeRate: true }` keeps an EUR invoice
    with no rate and rejects a HUF invoice and an EUR invoice with a rate.
2.4 `needsExchangeRate` composes with `status` and `search` (all three must match).
2.5 `buildInvoiceListQueryString({ limit: 25, needsExchangeRate: true })` contains
    `needsExchangeRate=1`; omitting/false emits no such param.
2.6 `GET /api/invoices?needsExchangeRate=1` calls `listInvoices` with
    `needsExchangeRate: true`; `GET /api/invoices` (no param) calls it without the flag.

**AC3 — the SQL filter is pushed into the query, not applied in JS**
3.1 The exported where-builder, given `{ needsExchangeRate: true }`, produces a clause
    that references both the `currency` and `exchange_rate` columns.
3.2 Given no filter, it produces neither.
3.3 No test requires a live Postgres connection (`@/db` stays mocked, per CLAUDE.md).

**AC4 — the invoice list surfaces the problem**
4.1 When the affected count is `0`, no banner renders on `/invoices`.
4.2 When the count is `> 0`, a banner renders with the count interpolated
    (`invoices.exchangeRateFix.banner`) and an action button.
4.3 Pressing the action switches the list to the affected-only view: `useInvoices` is
    called with `needsExchangeRate: true` and the status filter reset to `"all"`.
4.4 In the affected-only view the banner's action becomes "show all invoices" and
    returns the list to the unfiltered view.
4.5 The banner renders no hardcoded user-facing text — every string goes through `t()`.

**AC5 — the invoice detail screen explains and routes**
5.1 A detail screen for an EUR invoice with no rate renders the warning card
    (`invoices.exchangeRateFix.detailTitle` / `detailBody`, with `{{currency}}` filled).
5.2 A HUF invoice, and a EUR invoice with a rate, render no warning card.
5.3 The card's button navigates to `routes.invoiceEdit(id, { focus: "exchangeRate" })`.

**AC6 — the deep link lands on the field**
6.1 `routes.invoiceEdit("inv-1")` still returns the plain `/invoices/inv-1/edit` href
    (no regression for existing callers).
6.2 `routes.invoiceEdit("inv-1", { focus: "exchangeRate" })` returns an href carrying
    `focus=exchangeRate`.
6.3 `useInvoiceComposer({ initialFocusField: "exchangeRate" })` starts with
    `focusField === "exchangeRate"`; with no option it starts `null`.
6.4 (Already-shipped behaviour this relies on, assert it still holds:) `StepPartner`
    expands the Dates/Payment section and focuses the exchange-rate input when
    `focusField === "exchangeRate"` — covered by the existing
    `components/invoices/composer/StepPartner.test.tsx` describe block; it must stay green.

**AC7 — NAV submission refuses in the user's language, before any NAV call**
7.1 `POST /api/nav/submit` for an invoice where `isMissingExchangeRate` is true returns
    **409** with body `{ error: <string>, code: "missingExchangeRate" }`.
7.2 In that case `submitOutgoingInvoiceToNav` is **never called** (assert on the mock) —
    no NAV request is made, no `navSubmission` row is written.
7.3 An invoice with a valid rate still submits exactly as before (200, submission body
    unchanged).
7.4 A HUF invoice still submits exactly as before.

**AC8 — i18n parity and no scope creep**
8.1 Every new key exists in both `lib/i18n/locales/hu.ts` and `en.ts` with identical
    key paths (the repo's i18n parity check stays green).
8.2 `git diff --name-only main…HEAD` touches **no** file under `lib/nav/`, `lib/tax/`,
    `lib/m2m/`, or `marketing/`.
8.3 `db/schema.ts` is unchanged.
8.4 `npx tsc --noEmit` and `npm run test:unit` are green.

---

## 3. Files to touch

**Domain (pure)**
- `lib/invoices/exchange-rate.ts` — add `isMissingExchangeRate(invoice: Pick<Invoice, "currency" | "exchangeRate">): boolean`, a one-liner over `resolveExchangeRate`.
- `lib/invoices/list-query.ts` — add `needsExchangeRate?: boolean` to `InvoiceListFilters`; parse it in `normalizeInvoiceListFilters` (accept `"1"`/`"true"` only); honour it in `invoiceMatchesListFilters` (widen its `Pick<>` to include `currency` and `exchangeRate`); emit it in `buildInvoiceListQueryString`.

**Server**
- `lib/invoices/service.ts` — extract and **export** the existing private `buildListWhere` as `buildInvoiceListWhere(userId, options)` (same body, exported so it can be unit-tested), and add the clause when `options.needsExchangeRate` is set:
  `and(ne(invoice.currency, "HUF"), or(isNull(invoice.exchangeRate), lte(invoice.exchangeRate, "0")))`.
  `ne`, `or`, `lte` are already imported; add `isNull` to the `drizzle-orm` import.
- `app/api/invoices+api.ts` — pass `needsExchangeRate: url.searchParams.get("needsExchangeRate")` into `normalizeInvoiceListFilters` in `GET`. Nothing else in this file changes.
- `app/api/nav/submit+api.ts` — after the 404 check, `if (isMissingExchangeRate(invoice)) return jsonResponse({ error: "…", code: "missingExchangeRate" }, 409);` before `submitOutgoingInvoiceToNav`. Import `isMissingExchangeRate` from `@/lib/invoices/exchange-rate` (**not** from `lib/nav/`).

**Hooks**
- `hooks/useInvoices.ts` — add `needsExchangeRate?: boolean` to `UseInvoicesOptions`, thread it into `buildInvoiceListQueryString` and the `refresh` dependency list.
- `hooks/useMissingExchangeRateCount.ts` *(new)* — mirrors `hooks/useInvoiceStatusCounts.ts`: one `apiFetch<{ total: number }>("/api/invoices?needsExchangeRate=1&limit=1")`, returns `{ count, loading }`, swallows errors to `count: 0`, guards against setState-after-unmount with the same `cancelled` flag pattern.

**UI**
- `components/invoices/ExchangeRateFixBanner.tsx` *(new)* — purely presentational: `{ count: number; active: boolean; onShowAffected: () => void; onShowAll: () => void }`. Renders `null` when `count === 0 && !active`.
- `app/(app)/invoices/index.tsx` — render the banner above the filter chips; add `const [needsExchangeRate, setNeedsExchangeRate] = React.useState(false)`; pass it to `useInvoices`; reset `filter` to `"all"` when turning it on.
- `app/(app)/invoices/[id]/index.tsx` — render a warning `Card` directly under `InvoiceMoneyHeader` (above `InvoiceTimeline`) when `invoice && isMissingExchangeRate(invoice)`, with a button to `routes.invoiceEdit(invoice.id, { focus: "exchangeRate" })`.

**Deep link**
- `lib/navigation.ts` — `invoiceEdit(id: string, options?: { focus?: string }): Href` — plain string href when no options (AC6.1), `{ pathname, params: { focus } }` otherwise.
- `app/(app)/invoices/[id]/edit.tsx` — `const focus = useRouteParam("focus")`, pass `initialFocusField={focus ?? undefined}` to `InvoiceComposer`.
- `components/invoices/composer/useInvoiceComposer.ts` — add `initialFocusField?: string` to `UseInvoicesComposerOptions` and seed `React.useState<string | null>(options.initialFocusField ?? null)` at line ~139. **No other composer change** — `StepPartner` already reacts to `focusField === "exchangeRate"` (expands Dates/Payment, focuses, clears).

**i18n**
- `lib/i18n/locales/hu.ts`, `lib/i18n/locales/en.ts` — see §5.

---

## 4. Tests to write first (TDD)

Write each test, watch it fail, then implement. Order matters — the pure layers first.

1. `lib/invoices/exchange-rate.test.ts` *(extend)* — new `describe("isMissingExchangeRate")` covering AC1.1–1.6.
2. `lib/invoices/list-query.test.ts` *(extend)* — AC2.1–2.5.
3. `lib/invoices/service.test.ts` *(extend)* — AC3.1–3.2 against the newly exported
   `buildInvoiceListWhere`. Assert structurally, not on a rendered SQL string: walk the
   returned drizzle `SQL` object's `queryChunks` recursively and collect every `.name`
   found on a chunk, then
   `expect(names).toEqual(expect.arrayContaining(["currency", "exchange_rate"]))`.
   If drizzle's internals make that brittle in practice, fall back to asserting on
   `.getSQL().queryChunks` the same way — do **not** weaken this to "does not throw".
4. `__tests__/api/invoices/invoices-api.test.ts` *(extend)* — AC2.6, using the existing
   `jest.mock("@/lib/invoices/service")` setup.
5. `__tests__/api/nav/submit.test.ts` *(new)* — AC7.1–7.4. Mock `@/lib/api/session`,
   `@/lib/invoices/service` (`getInvoiceById`) and `@/lib/nav/submit-outgoing`
   (`submitOutgoingInvoiceToNav`); build invoices with `makeInvoice` from
   `@/__tests__/fixtures/invoices`. Follow `__tests__/api/receipts/submit-nav.test.ts`
   for the mocking shape.
6. `hooks/useInvoices.test.tsx` *(extend)* — the `needsExchangeRate: true` option puts
   `needsExchangeRate=1` in the fetched URL.
7. `hooks/useMissingExchangeRateCount.test.tsx` *(new)* — returns the API's `total`;
   returns `0` when `apiFetch` rejects.
8. `components/invoices/ExchangeRateFixBanner.test.tsx` *(new)* — AC4.1, 4.2, 4.5, and
   that `onShowAffected`/`onShowAll` fire per `active`.
9. `__tests__/screens/invoice-detail.test.tsx` *(extend)* — AC5.1–5.3. The file already
   mocks `expo-router`'s `router.push`, `react-i18next` (identity `t`), `apiFetch` and
   `InvoiceDocumentPreview` — reuse all of it.
10. `lib/navigation.test.ts` *(extend)* — AC6.1–6.2.
11. `components/invoices/composer/useInvoiceComposer.test.tsx` *(extend)* — AC6.3
    (the file already exposes the hook's state through a `ref`).

Existing suites that must stay green without edits: `StepPartner.test.tsx`
(AC6.4), `lib/nav/invoice-xml` tests, `create-from-payload.test.ts`.

---

## 5. i18n keys (hu + en)

New block `invoices.exchangeRateFix` in both locale files, plus one key under
`invoices.errors`. Copy is deliberately neutral about *which* rate to use — the app
must not imply a legally-correct rate source (the existing
`invoices.composer.exchangeRateHint` already says manual entry / MNB lookup planned).

| Key | hu | en |
|---|---|---|
| `invoices.exchangeRateFix.banner` | `{{count}} deviza számlához nincs rögzítve HUF-árfolyam, ezért nem küldhetők be a NAV-nak.` | `{{count}} foreign-currency invoices have no HUF exchange rate, so they cannot be submitted to NAV.` |
| `invoices.exchangeRateFix.showAffected` | `Érintett számlák` | `Show affected` |
| `invoices.exchangeRateFix.showAll` | `Összes számla` | `Show all invoices` |
| `invoices.exchangeRateFix.activeTitle` | `Árfolyam nélküli deviza számlák` | `Foreign-currency invoices without a rate` |
| `invoices.exchangeRateFix.emptyAffected` | `Nincs árfolyam nélküli deviza számla.` | `No foreign-currency invoice is missing a rate.` |
| `invoices.exchangeRateFix.detailTitle` | `Hiányzik a HUF-árfolyam` | `HUF exchange rate is missing` |
| `invoices.exchangeRateFix.detailBody` | `Ez a számla {{currency}} pénznemű, de nincs hozzá rögzítve árfolyam. A NAV Online Számla adatszolgáltatás forintban kéri az áfaértéket, ezért a beküldés addig nem lehetséges, amíg meg nem adod az árfolyamot.` | `This invoice is in {{currency}} but has no exchange rate. NAV Online Számla requires the VAT amount in forint, so it cannot be submitted until you enter the rate.` |
| `invoices.exchangeRateFix.addRate` | `Árfolyam megadása` | `Add exchange rate` |
| `invoices.errors.navMissingExchangeRate` | `A NAV beküldés nem lehetséges: a számlához nincs megadva HUF-árfolyam.` | `NAV submission is not possible: the invoice has no HUF exchange rate.` |

The 409 body's `error` string in `app/api/nav/submit+api.ts` stays a plain English
developer sentence (the server has no locale); the `code: "missingExchangeRate"` is the
machine-readable contract, matching the `ERROR_CODE_I18N_KEY` pattern already used by
`app/(app)/invoices/[id]/index.tsx` and `app/(app)/invoices/index.tsx`.

---

## 6. db/schema.ts changes

**None.** Not ADDITIVE, not DESTRUCTIVE — `db/schema.ts:181` already declares
`exchangeRate: numeric("exchange_rate", { precision: 12, scale: 6 })` as nullable, which
is exactly the state this item surfaces. No migration, no `drizzle-kit generate`, no
`db:push`. If the implementer finds themselves editing `db/schema.ts`, they have left
the plan.

---

## 7. UX notes

**Mobile (375px)**
- The list banner is a `Card` with `VStack space="sm"`: text on its own line (wraps
  freely — the Hungarian sentence is long), then a full-width `Button`. Never an
  `HStack` at this width, or the button gets squeezed under ~100px.
- Button keeps the shipped 44px tap-target floor (use the standard `Button` size the
  rest of the app uses — do not shrink it; see the `ChoicePill` slice).
- Detail warning card sits directly under the money header so it is above the fold on a
  375px screen — the EV should not have to scroll past the document preview to find out
  why NAV rejected the invoice.
- Long numbers/currency codes must not force horizontal scroll: no `flex-nowrap` on the
  banner text.

**Desktop (≥768px)**
- Banner becomes an `HStack className="items-center justify-between"` — text left,
  button right-aligned, matching the existing list header rhythm. Use `useIsDesktop()`,
  already imported in `app/(app)/invoices/index.tsx`.
- Detail warning card spans the detail column width; the button is `self-start`, not
  full-width (compare the existing `DangerZone` button treatment).

**Both**
- Styling: `border-destructive/40` + `text-destructive` for the warning accent — the
  palette has no `warning` token (`tailwind.config.js` colors: primary/secondary/
  destructive/muted/accent/popover/card). Do not invent one.
- `className` only, never `style={[…]}` — AGENTS.md §1.
- The affected-only view reuses the existing list rendering (cards on mobile, table on
  desktop); when it is empty, the existing `StateView` empty branch shows
  `invoices.exchangeRateFix.emptyAffected`.

---

## 8. Risk classification

**`none`.**

Reason: every change is read-only surfacing plus one *earlier, stricter* refusal.

- Nothing under `lib/tax/`, `lib/nav/`, `lib/m2m/` or `marketing/` is modified (AC8.2).
  The NAV guard lives in `app/api/nav/submit+api.ts` and calls the pure
  `isMissingExchangeRate` from `lib/invoices/`, so NAV report *content* is untouched —
  `buildNavInvoiceXml` still refuses exactly as it does today, this just stops the
  request before it starts and returns a typed 409 instead of an unhandled 500.
- No NAV environment default changes; no `production` endpoint is referenced; no
  credential is added.
- No tax figure, rate, or rate source is hardcoded, fetched or guessed — the user types
  the rate in the composer exactly as before.
- No schema change (§6), so no `db:push` question arises.

Ship may auto-merge this if typecheck + unit tests are green and no confirmed
high/medium finding remains.

**The tax/legal-gated half of backlog item 10 is explicitly NOT in this slice** — see §9.

---

## 9. Out of scope

1. **Retro-correcting invoices already reported to NAV with the old hardcoded
   `exchangeRate = 1`.** That is a NAV **MODIFY** submission question with real tax
   consequences (a previously reported HUF VAT base was wrong). It is **tax/legal-gated**
   and needs its own backlog item, its own plan, and human sign-off before any code that
   emits a MODIFY report ships. This slice must not submit, modify or re-submit anything
   to NAV. Leave the existing `docs/loop-queue.md` item-10 sentence about it in place so
   it is not lost.
2. **Any automatic rate lookup (MNB/ECB).** Explicitly excluded by the backlog item
   ("not a guessed rate") and by `exchange-rate.ts`'s module contract. No network call.
3. **A bulk "fix all" editor.** One invoice at a time through the existing composer;
   a batch editor would need its own validation and audit story.
4. **Backfilling `exchange_rate` in the database by script.** No data migration, no
   `db:push`, no SQL run against Neon. The value is user-entered or it is absent.
5. **`components/invoices/NavStatusCard.tsx`** — defined but not rendered by any screen
   today. Do not wire it up here; if it is ever mounted it will get the typed 409 for
   free via `ApiError.code`.
6. **Receipts (`nyugta`) with a missing rate** — a separate, already-filed follow-up
   (`receipts.navMissingExchangeRate` / `missing_exchange_rate`, see
   `docs/plans/2026-09-18-receipt-blocked-message-i18n-fallback.md`).
7. **Marketing copy.** Nothing in `marketing/` changes; this ships no new claim.

---

## 10. Open questions

- **OQ-1:** Should the affected-only view also be reachable from the dashboard
  (a next-action card) rather than only from `/invoices`? Deferred — the list banner is
  the smallest surface that answers "which ones", and the dashboard's next-actions block
  has its own design language. File as a follow-up if the UX review asks for it.
- **OQ-2:** `lte(invoice.exchangeRate, "0")` in the SQL clause defends against a
  non-positive stored rate that `normalizeExchangeRate` should already make impossible.
  Kept deliberately (belt and braces, and it matches `isMissingExchangeRate`); if
  drizzle's `numeric` typing rejects the string literal, use `sql` with an explicit
  numeric comparison rather than dropping the clause — the JS predicate and the SQL
  predicate must agree.
