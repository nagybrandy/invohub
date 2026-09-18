# Plan — Díjbekérő (proforma) → számla flow, round 2

Slug: `dijbekero-proforma-to-invoice-flow`
Branch (created later by Build, in its own worktree): `slice/dijbekero-proforma-to-invoice-flow`
Phase: 1 — Core invoicing, NAV-compliant
Date: 2026-09-18
Risk: **schema** (one additive partial unique index; no tax figure, no NAV
production behaviour, no marketing copy)

---

## 0. Where this item actually stands (read this first)

The literal checkbox ("DBK number, 'Számla készítése ebből' action") is
**already shipped** — PR #15 (`slice/dijbekero-convert-to-invoice-impl`) was
merged on 2026-09-15. `lib/invoices/numbering.ts` mints `DBK-YYYY-NNNNN`,
`lib/invoices/convert-proforma.ts` + `service.ts#convertProformaToInvoice`
build the draft, `app/api/invoices/[id]/convert+api.ts` serves it, and both
the detail screen and the list row offer the action. Storno/helyesbítő are
correctly refused on a díjbekérő (`storno+api.ts` / `modify+api.ts` return
`proformaNotStornoable`, and the detail screen hides the Danger-Zone storno
button for a proforma via `finalized && !isProforma`).

So this round is **not** a rebuild. It closes the four open review findings
filed against that merge in `docs/loop-queue.md` and adds the one piece of
real EV value the first round left out: **a díjbekérő that has already been
invoiced looks identical to one that has not** — in the list, in the row
menu, and in the "Kapcsolódó bizonylatok" card. An EV whose whole reason for
issuing a díjbekérő is "collect first, invoice after" cannot currently answer
"which díjbekérők still need a számla?" without opening each one.

Findings closed by this slice (all four are queue entries dated
2026-09-15, "ship review of slice/dijbekero-convert-to-invoice-impl"):

| # | Finding | Group |
|---|---------|-------|
| F1 | Check-then-act race lets the same díjbekérő convert twice (no transaction, no unique constraint) | A |
| F2 | AC20 has no automated test for the links card's rendered rows / click-through | B |
| F3 | Redundant nested `runAction("convert", handleConvert)` — double `setBusy`/try-catch | B |
| F4 | A cancelled prior conversion renders identically to a live one in the links card | B |

---

## 1. Goal and user value

For an egyéni vállalkozó running the collect-then-invoice flow:

1. **A díjbekérő can never silently become two számla drafts.** Today a
   double-click or two open tabs pass the `findExistingConversion` check
   concurrently and both insert (`convert+api.ts` does two sequential DB
   calls with no transaction, and the Neon HTTP driver has no interactive
   transaction). The DB itself must be the arbiter.
2. **The list answers "which díjbekérők are still open?" at a glance.** A
   converted díjbekérő gets a "Számlázva" marker, and its row menu offers
   "Számla megnyitása" (navigating to the real invoice) instead of a convert
   action that is guaranteed to 409.
3. **"Kapcsolódó bizonylatok" tells the truth.** After a
   convert → stornó → re-convert cycle, the card currently shows two
   identical rows. The cancelled one is labelled as cancelled.
4. The convert button stops double-wrapping its own busy state.

---

## 2. Acceptance criteria (numbered, testable)

### Group A — double-conversion integrity (schema)

1. `db/schema.ts`'s `invoice` table declares a partial unique index
   `invoice_converted_from_live_unique_idx` on
   `(user_id, converted_from_invoice_id)` with predicate
   `converted_from_invoice_id IS NOT NULL AND status <> 'cancelled'`, in the
   same style as the existing `invoice_user_number_unique_idx`.
2. `npx drizzle-kit generate` produces `drizzle/0003_*.sql` containing
   exactly that `CREATE UNIQUE INDEX ... WHERE ...` statement and **no**
   `DROP`, `ALTER ... TYPE`, or rename statement. (ADDITIVE — see §5.)
3. A new pure helper `isUniqueViolation(error, indexName?)` in
   `lib/db/unique-violation.ts` returns `true` for a Postgres `23505` error
   (matched on `code === "23505"` on the error or its `cause`, or on the
   index name appearing in `message`), and `false` for any other error,
   including `undefined`/`null`/a plain `Error("boom")`.
4. `convertProformaToInvoice` (`lib/invoices/service.ts`) is unchanged in
   its happy path; the **route** `app/api/invoices/[id]/convert+api.ts`
   wraps the call in a try/catch: on `isUniqueViolation(e,
   "invoice_converted_from_live_unique_idx")` it re-runs
   `findExistingConversion` and returns the *existing* 409 body
   `{ code: "alreadyConverted", invoice }` — the identical shape the
   pre-check already returns, so no client change is needed.
5. If the violation fires but the re-lookup returns `null` (the winner was
   cancelled in between), the route rethrows rather than returning a 409
   with a null invoice.
6. A route-level test drives `convertProformaToInvoice` to reject with a
   fake `23505` error and asserts a 409 with the existing invoice in the
   body — i.e. the race resolves to "open the one that won", never a 500.

### Group B — links card and convert button correctness

7. `app/(app)/invoices/[id]/index.tsx` renders `convertedToInvoices`
   entries whose `status === "cancelled"` with
   `t("invoices.links.convertedToCancelled", { number })` and non-cancelled
   ones with the existing `invoices.links.convertedTo` — the two rows are
   textually distinguishable after a stornó-then-reconvert cycle.
8. The primary convert button calls `() => void handleConvert()` directly;
   `runAction("convert", ...)` appears exactly once in the convert path
   (inside `handleConvert`), matching every other self-wrapping handler on
   the screen.
9. `__tests__/screens/invoice-detail.test.tsx` gains a case with a populated
   `convertedFromInvoice` asserting the rendered
   `invoices.links.convertedFrom` row and that pressing it calls
   `router.push` with the source díjbekérő's detail route.
10. The same file gains a case with **two** `convertedToInvoices` — one
    `draft`, one `cancelled` — asserting: both rows render, they carry the
    two different i18n keys (AC7), pressing the live row navigates to it,
    and the primary action is `invoices.convert.openExisting` (the cancelled
    one does not count as a live conversion).

### Group C — converted díjbekérő is visible in the list

11. `lib/invoices/service.ts` exports
    `findLiveConversionsForProformas(userId, proformaIds: string[]):
    Promise<Record<string, string>>` mapping each díjbekérő id to the id of
    its non-cancelled conversion. An empty input array short-circuits to
    `{}` with **no** DB query.
12. `app/api/invoices+api.ts`'s `GET` includes
    `convertedProformaIds: Record<string, string>` in the JSON response,
    computed only from the `documentType === "proforma"` rows on the
    current page (never a full-table scan).
13. `hooks/useInvoices.ts` exposes `convertedProformaIds` (defaulting to
    `{}` on load/error) alongside `invoices`.
14. In `app/(app)/invoices/index.tsx`, a díjbekérő listed in
    `convertedProformaIds` shows the menu item
    `t("invoices.convert.openExisting")` navigating to
    `routes.invoiceDetail(<converted id>)`, **instead of**
    `t("invoices.convert.action")`. A non-converted díjbekérő is unchanged.
15. `InvoiceListRow` accepts an optional `converted?: boolean` and, when
    true, renders `t("invoices.convert.convertedBadge")` as a small muted
    sub-label under the document number (the same shape the existing
    unnumbered-draft branch already uses). `InvoiceListTable` threads it
    through via an optional `convertedIds?: Record<string, string>`.
16. `InvoiceCard` (mobile) accepts the same `converted?: boolean` and
    renders the badge next to the number; when converted, its menu entry is
    the "open existing" one (AC14) rather than convert.
17. No badge/menu change for any non-proforma document type.

### Cross-cutting

18. `npx tsc --noEmit` clean and `npm run test:unit` green.
19. Every new user-facing string exists in **both** `lib/i18n/locales/hu.ts`
    and `en.ts` with the same key path (`npm run test:unit` covers parity if
    an i18n parity test exists; otherwise check by hand).
20. No test requires a live Postgres connection — `@/db` stays mocked, as in
    the existing `lib/invoices/service.test.ts`.

---

## 3. Tests to write first (TDD order)

Write each test, watch it fail, then implement.

1. `lib/db/unique-violation.test.ts` (new) — AC3: `23505` on the error, on
   `error.cause`, index name in the message, and the negative cases.
2. `lib/invoices/service.test.ts` (extend) — AC11:
   `findLiveConversionsForProformas` returns the map, skips cancelled
   conversions, and makes no DB call for `[]`.
3. `__tests__/api/invoices/convert-api.test.ts` (extend — it already exists
   and already mocks `@/lib/invoices/service`) — AC4-6: make
   `convertProformaToInvoice` reject with `{ code: "23505" }` and assert the
   409 body; plus the AC5 rethrow case.
   `__tests__/api/invoices/invoices-api.test.ts` (extend) — AC12.
4. `__tests__/screens/invoice-detail.test.tsx` (extend) — AC9, AC10, AC7,
   AC8.
5. `components/invoices/InvoiceListRow.test.tsx` and
   `InvoiceCard.test.tsx` (extend) — AC15-17: badge renders when
   `converted`, absent otherwise, absent for a non-proforma.
6. Then implement Groups A → B → C in that order; A is the one that can
   fail at migration time, so land it first.

---

## 4. Files to touch

**Schema / data**
- `db/schema.ts` — the partial unique index (AC1)
- `drizzle/0003_*.sql` — generated, do not hand-edit beyond a header comment
- `lib/db/unique-violation.ts` + `.test.ts` — new

**Server**
- `lib/invoices/service.ts` — `findLiveConversionsForProformas` (AC11)
- `lib/invoices/service.test.ts`
- `app/api/invoices/[id]/convert+api.ts` — violation → 409 (AC4-5)
- `app/api/invoices+api.ts` — `convertedProformaIds` (AC12)

**Client**
- `hooks/useInvoices.ts` (AC13)
- `app/(app)/invoices/index.tsx` (AC14)
- `app/(app)/invoices/[id]/index.tsx` (AC7-8)
- `components/invoices/InvoiceListRow.tsx`, `InvoiceListTable.tsx`,
  `InvoiceCard.tsx` (AC15-16)

**i18n**
- `lib/i18n/locales/hu.ts`, `lib/i18n/locales/en.ts`

**Tests**
- `__tests__/screens/invoice-detail.test.tsx`
- `__tests__/api/invoices/convert-api.test.ts`,
  `__tests__/api/invoices/invoices-api.test.ts`
- `components/invoices/InvoiceListRow.test.tsx`, `InvoiceCard.test.tsx`

---

## 5. db/schema.ts changes — **ADDITIVE**

One new partial unique index on an existing column. No new column, no
`DROP`, no rename, no type change, no data migration. `db:push` is
permitted by CLAUDE.md for this shape.

**One caveat Ship must respect:** creating a unique index can *fail* if the
production table already contains a duplicate — i.e. if the F1 race has
already fired for a real user. That is a data condition, not a code bug. If
`db:push` errors with a unique-violation on
`invoice_converted_from_live_unique_idx`, **Ship must stop and report it**,
not force or drop anything; the duplicate rows have to be looked at by a
human (the extra row is a harmless unnumbered draft, so cancelling or
deleting one is the likely resolution — but that is a human decision on
production data, not an agent's).

---

## 6. i18n keys (hu + en)

Added under `invoices`:

| Key | hu | en |
|-----|----|----|
| `invoices.links.convertedToCancelled` | `"Ebből készült számla (sztornózva): {{number}}"` | `"Invoice created from this (cancelled): {{number}}"` |
| `invoices.convert.convertedBadge` | `"Számlázva"` | `"Invoiced"` |

Reused unchanged: `invoices.convert.action`, `invoices.convert.openExisting`,
`invoices.links.convertedTo`, `invoices.links.convertedFrom`.

Note for the implementer: `{{number}}` may be empty for an unnumbered draft
conversion — the existing call sites already fall back to
`t("invoices.status.draft")`; keep that fallback on the new key too.

---

## 7. UX notes

**Mobile (375px)**
- The "Számlázva" badge goes under/next to the document number in
  `InvoiceCard`, as a `size="xs"` muted `Text` — **not** a new chip row. The
  card already carries an `InvoiceStatusChip`; a second chip at 375px pushes
  the amount out of the row. Keep it to one short word.
- The row menu keeps exactly one convert-family entry (either "Számla
  készítése ebből" or "Számla megnyitása", never both) so the "⋯" sheet does
  not grow.
- Do not add any new tap target under 44px. The badge is non-interactive
  text; navigation stays on the existing row press and menu items.

**Desktop (≥768px)**
- `InvoiceListRow`'s serial column is 132px wide and already renders a
  two-line `VStack` for unnumbered drafts — reuse that exact shape so the
  row height does not change for converted rows.
- On the detail screen, the cancelled-conversion link row uses the same
  `Pressable` + muted text as the others; distinguish it by the i18n string
  (AC7), not by a new colour — the card is a plain list, and red there would
  read as an error in the current document.

**Both**
- Nothing about this slice changes what is printed on a document, sent to
  NAV, or shown in marketing copy.

---

## 8. Risk classification

**schema** — one additive partial unique index plus its generated migration.

Explicitly *not* tax/legal: no tax figure, no `lib/tax/` file, no
`lib/nav/` production behaviour, no `lib/m2m/`, no compliance/marketing
copy. The díjbekérő document disclaimer ("nem számla, áfa levonására nem
jogosít") remains deliberately **out of scope** and sign-off-gated (see §9),
exactly as the 2026-09-15 plan recorded.

Ship may auto-merge this once typecheck + unit tests are green and no
confirmed high/medium finding remains, subject to the §5 `db:push` caveat.

---

## 9. Out of scope

- **The díjbekérő disclaimer text on the rendered document/PDF** — legal
  copy, needs human sign-off; stays a separate queue item.
- Carrying the díjbekérő's paid state / payment date onto the converted
  invoice (teljesítési dátum semantics for an advance payment are
  tax-gated — do not guess).
- The hardcoded Hungarian `"Díjbekérő alapján: …"` notes string in
  `lib/invoices/convert-proforma.ts` (needs a locale on the server route;
  file it, don't fix it here).
- The identical check-then-act race in `storno+api.ts` — same pattern, own
  item; this slice fixes only the convert path.
- Any NAV/e-nyugta work, the advance-invoice (`ELO-`) flow, pagination of
  the links card, and the open tap-target items (queue item 8).
- Marketing copy of any kind.
