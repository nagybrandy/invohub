# Plan — receipt-blocked-message-i18n-fallback

- **Slug:** `receipt-blocked-message-i18n-fallback`
- **Branch (Build phase creates it):** `slice/receipt-blocked-message-i18n-fallback`
- **Base branch:** `slice/e-nyugta-nav-receipt-api` — **not `main`**
- **Phase:** Phase 1 — Core invoicing, NAV-compliant
- **Backlog item:** Ship-review follow-up (low, `slice/e-nyugta-nav-receipt-api`, 2026-09-18)
- **Date:** 2026-09-18

---

## 0. Read this before branching — the base is not `main`

Every file this item names (`BLOCKED_MESSAGE_HU`, `lib/receipts/daily-report.ts`,
`receipts.navMissingExchangeRate`, the rebuilt `app/api/cron/nav-receipt-report+api.ts`)
exists **only** on `slice/e-nyugta-nav-receipt-api`. `main` still carries the old
`lib/nav-receipt/` implementation and has none of these symbols:

```
$ git rev-list --count main..slice/e-nyugta-nav-receipt-api   # 3 commits, 32 files
$ rg -n 'BLOCKED_MESSAGE_HU' -- app lib                        # no matches on main
```

Consequences the Build phase **must** honour:

1. Branch from `slice/e-nyugta-nav-receipt-api`, not `main`:
   `git worktree add <path> -b slice/receipt-blocked-message-i18n-fallback slice/e-nyugta-nav-receipt-api`
2. The result is a **stacked PR onto `slice/e-nyugta-nav-receipt-api`**. It must
   **not** be merged into `main` by Ship — the parent slice is still pending the
   tax/legal sign-off recorded in `docs/loop-queue.md` (OQ-1…OQ-6 of
   `docs/plans/2026-09-18-e-nyugta-nav-receipt-api.md`). See §8.
3. If the parent slice gets merged to `main` before this runs, rebase onto `main`
   instead — the diff is identical either way.

---

## 1. Goal and user value

A Hungarian EV who issues a EUR (or any non-HUF) nyugta gets a NAV row that says
the day's non-HUF group could not be reported. Today that sentence is a raw
Hungarian string literal baked into the database at write time, so:

- **An English-locale user sees Hungarian.** `receipts.navMissingExchangeRate`
  was translated into `en.ts` and never wired up; the screen renders
  `navError` verbatim with no `t()` call
  (`app/(app)/receipts/[id]/index.tsx:201`).
- **The sentence is load-bearing as a database key.**
  `app/api/receipts/[id]+api.ts` tells a blocked non-HUF row apart from a HUF
  row for the same `reportDate` by comparing `errorMessage` to that *exact
  Hungarian sentence*. Any copy edit — a comma, a NAV wording change, a
  translator's pass — silently makes the detail screen attach the wrong
  currency group's NAV status to the receipt. That is a real correctness bug
  waiting on a copy change, and it is the reason this "low" item is worth
  doing properly rather than as a one-line `t()` wrap.
- **The message does not say which currency was blocked.** The EV sees "non-HUF
  receipt…" with no hint that it was their EUR sale, and no next step.

After this change `errorMessage` stores the stable machine code
`missing_exchange_rate` (already the value of `BlockedReceiptGroup.reason`),
the screen renders it through `t("receipts.navMissingExchangeRate", { currency })`,
and copy edits can never again break row attribution.

---

## 2. Acceptance criteria (testable, numbered)

**AC1 — the reason code is the stored value**
1.1 A blocked non-HUF group writes `navReceiptSubmission.errorMessage === "missing_exchange_rate"` in `POST /api/receipts/[id]/submit-nav`.
1.2 Same in `GET /api/cron/nav-receipt-report`.
1.3 Neither route file, and no row either writes, contains any Hungarian prose: `rg -n 'Nem HUF|árfolyam' app/api/receipts app/api/cron` returns no matches.
1.4 `BLOCKED_EXCHANGE_RATE_MESSAGE_HU` no longer exists anywhere in the repo, and neither does the local `BLOCKED_MESSAGE_HU` alias in either route file.

**AC2 — NAV's own error text is untouched**
2.1 A genuine NAV rejection still stores NAV's verbatim text (e.g. `"VALIDATION_ERROR Bad data"`) in `errorMessage` — the code path for `result.error` is unchanged.
2.2 `navReceiptErrorI18nKey("VALIDATION_ERROR Bad data")` returns `null`, so the screen falls back to rendering NAV's text as-is.

**AC3 — row attribution no longer depends on Hungarian copy**
3.1 For a HUF receipt, `GET /api/receipts/[id]` returns the day's non-blocked row (`navReportId` set, `navError` null) even when a blocked EUR row for the same `reportDate` sorts first.
3.2 For a non-HUF receipt, the same endpoint returns the blocked row, with `navError === "missing_exchange_rate"`.
3.3 The discriminator is `isNavReceiptBlockedReason(row.errorMessage)`, not a string-equality check against any translated sentence.

**AC4 — the user sees their own language**
4.1 `ReceiptNavCard` renders `t("receipts.navMissingExchangeRate", { currency })` when `navError` is a known blocked-reason code — it never renders the raw code.
4.2 With `navError = "VALIDATION_ERROR Bad data"` it renders that string unchanged (no `t()` lookup, no `receipts.` key leaking into the UI).
4.3 The interpolated `{{currency}}` comes from the receipt being viewed (e.g. `EUR`), so the message names the actual currency.

**AC5 — i18n hygiene**
5.1 `receipts.navMissingExchangeRate` exists in both `hu.ts` and `en.ts` and both contain the `{{currency}}` placeholder.
5.2 The hu/en key-parity test in `lib/i18n/locales/en.test.ts` stays green.
5.3 `rg -n 'navMissingExchangeRate' -- components lib app` shows at least one real call site (the key is no longer dead).

**AC6 — green build**
6.1 `npx tsc --noEmit` clean.
6.2 `npm run test:unit` fully green (parent branch baseline: 207 suites / 1254 tests).

---

## 3. Tests to write first (TDD order)

Write each failing test before the implementation it describes.

1. **`lib/receipts/nav-error-code.test.ts`** *(new)*
   - `NAV_RECEIPT_BLOCKED_REASONS` contains exactly `["missing_exchange_rate"]`.
   - `isNavReceiptBlockedReason("missing_exchange_rate")` → `true`;
     `isNavReceiptBlockedReason("VALIDATION_ERROR Bad data")`, `("")`, `(null)` → `false`.
   - `navReceiptErrorI18nKey("missing_exchange_rate")` → `"receipts.navMissingExchangeRate"`;
     unknown / null input → `null`. **(AC2.2)**

2. **`lib/receipts/daily-report.test.ts`** *(extend)*
   - A non-HUF group's `reason` is assignable to `NavReceiptBlockedReason` and
     equals `"missing_exchange_rate"`.
   - `daily-report.ts` no longer exports `BLOCKED_EXCHANGE_RATE_MESSAGE_HU`
     (`expect((mod as Record<string, unknown>).BLOCKED_EXCHANGE_RATE_MESSAGE_HU).toBeUndefined()`). **(AC1.4)**

3. **`__tests__/api/receipts/submit-nav.test.ts`** *(rewrite the blocked case)*
   - Replace the local `BLOCKED_EXCHANGE_RATE_MESSAGE_HU` mock constant (lines ~32-33)
     and the `expect(insertedValues.errorMessage).toContain("HUF")` assertion
     (line ~236) with `expect(insertedValues.errorMessage).toBe("missing_exchange_rate")`. **(AC1.1)**
   - Keep the existing `"VALIDATION_ERROR Bad data"` assertion (line ~219) as the
     AC2.1 regression guard.

4. **`__tests__/api/cron/nav-receipt-report.test.ts`** *(same edit)* **(AC1.2)**

5. **`__tests__/api/receipts/receipt-crud.test.ts`** *(update both discriminator tests)*
   - The local `BLOCKED_MESSAGE_HU` fixture (lines ~248-250) becomes
     `"missing_exchange_rate"`; the two ordering tests (~251, ~274) keep their
     shape and now assert `body.navError === "missing_exchange_rate"`. **(AC3.1, AC3.2)**

6. **`components/receipts/ReceiptNavCard.test.tsx`** *(new)*
   - Follow `components/invoices/NavStatusCard.test.tsx`: mock `react-i18next`
     with the key-passthrough `t`, mock the gluestack primitives from
     `@/__tests__/mocks/gluestack-ui`.
   - `navError="missing_exchange_rate"`, `currency="EUR"` → the rendered tree
     contains `receipts.navMissingExchangeRate` (the key, via the passthrough
     mock) and `t` was called with `{ currency: "EUR" }`; it does **not**
     contain the bare string `missing_exchange_rate`. **(AC4.1, AC4.3)**
   - `navError="VALIDATION_ERROR Bad data"` → rendered verbatim, no `receipts.`
     key in the tree. **(AC4.2)**
   - `navError={null}` → no error block rendered at all.

7. **`lib/i18n/locales/en.test.ts`** *(extend)*
   - Both locales define `receipts.navMissingExchangeRate` and both include
     `{{currency}}`. **(AC5.1)**

---

## 4. Files to touch

| File | Change |
|---|---|
| `lib/receipts/nav-error-code.ts` | **new** — `NAV_RECEIPT_BLOCKED_REASONS`, `NavReceiptBlockedReason`, `isNavReceiptBlockedReason()`, `navReceiptErrorI18nKey()`. The single source of truth for the code↔key mapping. |
| `lib/receipts/daily-report.ts` | Delete `BLOCKED_EXCHANGE_RATE_MESSAGE_HU` and its comment block. Type `BlockedReceiptGroup.reason` as `NavReceiptBlockedReason` (imported), not an inline literal. |
| `app/api/receipts/[id]/submit-nav+api.ts` | Delete the `BLOCKED_MESSAGE_HU` alias (lines 19-21) and the import. In the `for (const group of blocked)` loop write `errorMessage: group.reason` and push `{ ok: false, error: group.reason }`. |
| `app/api/cron/nav-receipt-report+api.ts` | Same: delete the alias (lines 16-17), write `group.reason`. |
| `app/api/receipts/[id]+api.ts` | Swap the sentence-equality discriminator for `isNavReceiptBlockedReason(row.errorMessage)`; rewrite the long comment to say the discriminator is now a stable code, not translatable copy. |
| `components/receipts/ReceiptNavCard.tsx` | **new** — pure extraction of the NAV `<Card>` block from the detail screen (lines ~159-205), plus the `navReceiptErrorI18nKey` fallback render. Props: `{ navSubmitted, navMode, navReportId, navError, currency }`. |
| `app/(app)/receipts/[id]/index.tsx` | Replace the inlined NAV card with `<ReceiptNavCard … currency={receipt.currency} />`. No other change. |
| `lib/i18n/locales/hu.ts` | Reword `receipts.navMissingExchangeRate` with `{{currency}}` (§5). |
| `lib/i18n/locales/en.ts` | Same. |
| `docs/loop-queue.md` | Tick the item, note the stacked-PR base branch. |

### Rendering contract (the whole behaviour change, in one place)

```ts
// components/receipts/ReceiptNavCard.tsx
const errorKey = navReceiptErrorI18nKey(navError);
const errorText = errorKey ? t(errorKey, { currency }) : navError;
```

`navError` is untrusted server data; anything the mapping does not recognise
(every real NAV error string) is rendered verbatim, exactly as today.

### Why not an `errorCode` column

`navReceiptSubmission` has no `errorCode` column and adding one would be an
additive migration plus a `db:push` on a branch that cannot ship yet. The
backlog item explicitly asks for the code in `errorMessage`, and the column is
already free-text carrying NAV's own error strings. **Deliberately deferred** —
if a second blocked reason ever appears, revisit (§9).

---

## 5. i18n keys (hu + en)

One existing key, reworded to interpolate the currency. No new keys, no removals
(so `en.test.ts` parity is unaffected).

| Key | hu | en |
|---|---|---|
| `receipts.navMissingExchangeRate` | `Nem HUF ({{currency}}) nyugta: nincs rögzített árfolyam, ezért kimaradt a napi NAV-adatszolgáltatásból.` | `Non-HUF ({{currency}}) receipt: no exchange rate on file, so it was left out of the daily NAV data report.` |

Wording notes:
- Names the actual currency, so the EV can tell which sale is affected.
- "kimaradt a napi NAV-adatszolgáltatásból" is accurate about what happened —
  the day's HUF group may well have been reported successfully; the previous
  wording ("nem küldhető be a NAV-nak") overstated it.
- **No promise of a fix and no instruction to record a rate** — `receipt` has no
  `exchangeRate` column yet (that is the separate filed follow-up, §9). Do not
  write copy that tells the user to do something the app cannot do.

---

## 6. `db/schema.ts` changes

**None.** No new table, column, index or migration. Nothing to `db:push`.
The change is purely what value gets written into the existing
`nav_receipt_submission.error_message` text column.

Existing rows written by the parent branch still hold the old Hungarian
sentence. That is acceptable and needs no backfill: the parent slice has never
been merged or deployed, so no production row can contain it. If one somehow
did, `navReceiptErrorI18nKey` returns `null` for it and the screen renders the
Hungarian sentence — the current behaviour, not a regression.

---

## 7. UX notes

**Mobile (375px)**
- The NAV card is inside `ScreenLayout` → `VStack space="md"`; the extracted
  component must keep the exact same classNames so nothing reflows.
- The error block stays a `VStack space="xs"` with a `size="xs"` label above the
  message — it wraps rather than truncating, which matters because the Hungarian
  string is ~95 characters and will run to three lines at 375px. Verify no
  horizontal overflow.
- Keep `className="text-destructive"` on the message so it reads as a problem,
  not a neutral note.

**Desktop (≥768px)**
- Same card inside the sidebar layout; the message sits in a wider column and
  should be one or two lines. No layout change expected.

**Both**
- This is a display-only change — no new tap targets, so the 44px floor from
  `slice/invoice-flow-tap-targets-44px` is not in play.
- Do **not** touch the `selectable` prop on the `navReportId` / `qrUrl` `Text`
  nodes while moving the block; that web console warning is its own filed
  follow-up item (§10).
- Language switch: flipping hu↔en must now change this message live, since it
  goes through `t()`. Worth a manual check in the Build phase's smoke pass.

---

## 8. Risk classification

**`tax-legal`.**

The code change itself is display-and-plumbing only: no tax figure, no rate, no
marketing claim, no NAV production endpoint (the touched routes run `demo`/`test`
only, and the cron route filters `eq(company.navEnvironment, "test")`).

But the branch is **stacked on `slice/e-nyugta-nav-receipt-api`**, which is
explicitly held for human tax/legal sign-off (the eRECEIPT VAT category names are
still an unverified constant with a sourced TODO, per that slice's OQ-1…OQ-6).
Merging this into `main` would drag the entire gated slice in with it.

**Ship must therefore open a PR against `slice/e-nyugta-nav-receipt-api` and
stop. No merge to `main`, no `vercel --prod`, no `db:push`.**

---

## 9. Out of scope

- Adding `receipt.exchangeRate` (additive numeric, nullable) — the thing that
  would actually unblock non-HUF nyugta reporting. Already filed as its own
  backlog item by the parent slice; it is a schema + NAV-XML change and belongs
  in a separate, separately-gated slice.
- Adding an `errorCode` column to `nav_receipt_submission` (§4).
- Adding a `currency` column to `nav_receipt_submission` — the deferred fix for
  the row-attribution problem this item only papers over more safely. Note it in
  the PR body; do not build it.
- Fixing the `selectable` prop web console warning on `navReportId` / `qrUrl` —
  separate filed follow-up item, and it predates this slice.
- Verifying the eRECEIPT VAT category names against NAV spec §5.9 — that is the
  parent slice's tax/legal gate, not this item.
- Any change to `lib/nav-receipt/` (auth, signature, xml-builder, report).
- Any `lib/tax/`, `lib/m2m/`, or `marketing/` change.
- Backfilling or migrating existing `error_message` rows (§6).

---

## 10. Definition of done

1. All seven test files from §3 written first and failing, then green.
2. `npx tsc --noEmit` clean; `npm run test:unit` green.
3. `rg -n 'BLOCKED_EXCHANGE_RATE_MESSAGE_HU|BLOCKED_MESSAGE_HU' .` → no matches
   outside `docs/`.
4. `rg -n 'Nem HUF|árfolyam' app/ lib/receipts/` → matches only in
   `lib/i18n/locales/hu.ts`.
5. Manual smoke on web: a non-HUF receipt detail in `en` shows the English
   sentence with the currency interpolated; switching to `hu` swaps it live.
6. PR opened against `slice/e-nyugta-nav-receipt-api`, body naming the tax/legal
   gate and the deferred `currency` column. **Not merged to `main`.**
