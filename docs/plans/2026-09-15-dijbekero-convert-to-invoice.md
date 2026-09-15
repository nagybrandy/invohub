// docs/plans/2026-09-15-dijbekero-convert-to-invoice.md
# Plan — Díjbekérő → számla: "Számla készítése ebből"

- Backlog item: Phase 1 — Core invoicing, NAV-compliant. Owner priority #5
  ("Díjbekérő (proforma) → real flow: DBK number, »Számla készítése ebből«
  action that converts to a final invoice"), same as the open queue entry
  "Díjbekérő (proforma) is a dead end".
- Slug: `dijbekero-convert-to-invoice`
- Branch: `slice/dijbekero-convert-to-invoice`
- Date: 2026-09-15
- Risk: **schema** (one ADDITIVE nullable self-reference column + its index —
  see §8). Not tax-legal, not NAV-production: nothing in this slice touches
  `lib/tax/`, `lib/m2m/`, NAV credentials, NAV environment defaults, the NAV
  XML builder, or any marketing/compliance copy.

---

## 1. Goal and user value

The díjbekérő half of the flow already works: `DocumentTypeTabs` offers
"Díjbekérő", `composer-logic.resolveStatusForAction` pins its status to
`proforma`, and `lib/invoices/numbering.ts` mints a real `DBK-2026-00001`
number from its own per-year sequence. **The other half does not exist.**
Once the EV's customer pays the díjbekérő, there is no way in the app to turn
it into the számla the customer is legally owed. `lib/invoices/service.ts` has
`duplicateInvoice`, `createStornoInvoice` and `createModificationDraft` — and
nothing that moves a document from one type to the next. `app/(app)/invoices/
[id]/index.tsx` has no such action either. The díjbekérő is also *read-only*
(status `proforma` ≠ `draft`, so `edit.tsx` refuses to edit it), so today the
EV's only escape is to retype the whole document by hand as a new invoice, or
to press "Másolás" — which copies it back as **another díjbekérő**
(`duplicateInvoice` preserves `documentType` for everything but storno/modify).

**After this slice the EV gets:** one button on the paid díjbekérő —
**"Számla készítése ebből"** — that opens a prefilled invoice draft carrying
the same partner, the same lines (description, mennyiség, egységár, ÁFA kulcs
*and* ÁFA kategória/mentesség indoklás), the same currency and HUF árfolyam,
and the same payment method, with today's kiállítási dátum and the same
fizetési határidő span the díjbekérő used. The two documents stay linked in
both directions, so the invoice says which díjbekérő it settles and the
díjbekérő says which számla was issued from it. Converting twice is refused,
so one collection can never silently become two invoices.

### Two correctness bugs this slice also closes

Both are in the code paths this slice already has open, both are one-line
guards, and leaving them in place would make the new flow actively dangerous:

- **(a) "Sztornó" on a díjbekérő mints an INV- number.** The DangerZone offers
  Sztornó for any non-draft document (`app/(app)/invoices/[id]/index.tsx:485`),
  and `createStornoInvoice` saves the storno with `documentType: "storno"`,
  which `sequenceBucketForDocType` maps to the **`invoice`** bucket. Stornoing
  a díjbekérő therefore burns a real `INV-2026-000NN` számlaszám on a
  cancellation of a document that was never a számla — a gap in the
  continuous invoice numbering, which is exactly what Áfa tv. numbering rules
  forbid. A díjbekérő is not an adóügyi bizonylat; it is withdrawn, not
  stornózva. Fix: the storno/helyesbítő actions are not offered for
  `documentType === "proforma"` (the API refuses them too).
- **(b) "Helyesbítő számla" on a díjbekérő** has the same shape
  (`createModificationDraft` → `documentType: "modify"` → `invoice` bucket)
  and is equally meaningless. Same guard.

### Explicitly *not* a NAV change

A díjbekérő is never reported to NAV Online Számla, and after this slice it
still is not: `useInvoiceComposer` only calls `/api/nav/submit` when
`status === "sent" && navEnabled`, and a proforma document always saves as
`proforma`. The **converted invoice** is a normal draft, so it is reported
exactly like any other számla — when, and only when, the user finalizes it in
the composer with the NAV toggle on. No auto-submission is added here.

---

## 2. Design decisions (so the implementer does not have to invent them)

**(a) The conversion produces a DRAFT, not a finalized invoice.** It is
`createModificationDraft`'s shape, not `createStornoInvoice`'s: `status:
"draft"`, `invoiceNumber: ""`. Three reasons: no `INV-` sequence number is
burned until the user actually commits (`assignInvoiceNumberIfNeeded` only
allocates off `draft`); the user still has to confirm teljesítés/fizetési
határidő and press "Véglegesítés" or "Véglegesítés és küldés"; and the NAV
submission toggle stays an explicit human decision instead of being smuggled
into a one-tap button. The action routes to `routes.invoiceEdit(draft.id)`,
which is where the composer already lives and already validates everything.

**(b) Link direction: forward pointer on the new invoice.** New column
`invoice.converted_from_invoice_id` on the **invoice**, pointing back at the
díjbekérő — same shape as the existing `original_invoice_id` /
`modifies_invoice_id` self-references, so `findInvoicesReferencing` gives the
reverse direction for free. No column is added to the proforma row.

**(c) Dates are recomputed, never copied.** `issueDate` = today (a számla
issued weeks after the díjbekérő must not carry the díjbekérő's kelt).
`dueDate` = today + the **same day span** the díjbekérő used
(`dueDate − issueDate`, floored at 0), so an "8 napos" díjbekérő yields an
8-day invoice instead of a due date already in the past. Span is computed on
UTC midnight from the `YYYY-MM-DD` strings — no timezone arithmetic.

**(d) What is copied, what is dropped.** Copied: `clientId`, `clientName`,
`clientTaxNumber`, `currency`, `exchangeRate` (critical — the non-HUF slice
made this a hard requirement for NAV submission and the PDF), `paymentMethod`,
`notes`, and every line item field (`description`, `quantity`, `unitPrice`,
`vatRate`, `vatCategory`, `vatExemptionReason`, `unit`) with **fresh line
ids**. Dropped: `paidAt`, `paidAmount` (payment was recorded against the
díjbekérő; the invoice starts unpaid and Phase 2's bank matching owns the
rest), `originalInvoiceId`, `modifiesInvoiceId`, `modificationIndex`.

**(e) Notes get one appended reference line**, matching the existing
`createStornoInvoice` / `createModificationDraft` convention, and **appended**
rather than overwriting whatever the user wrote:
`Díjbekérő alapján: DBK-2026-00001` (falls back to the source id when the
díjbekérő somehow has no number), joined to any existing notes with `\n`.

**(f) Converting twice is refused (409), not silently allowed.** Before
creating, look for an existing conversion (`convertedFromInvoiceId === source.id`
and `status !== "cancelled"`). If one exists, the API returns 409 with the
existing invoice in the body, and the UI's primary action turns into "Számla
megnyitása" pointing at it. A *cancelled* conversion does not block a retry —
if the EV stornózta the issued számla, they must be able to issue a new one.

**(g) No new `InvoiceStatus`.** A "számlázva" proforma status would touch
`status-visuals`, `status-i18n`, `list-query`, the chips, the dashboard
summary and the document renderer — a whole separate slice. The link row
("Ebből készült számla: INV-2026-00007") carries the same information, and
the díjbekérő keeps status `proforma`. Filed as out-of-scope follow-up.

---

## 3. Acceptance criteria (testable, numbered)

**Pure conversion logic — `lib/invoices/convert-proforma.ts`**

1. `dueDateSpanDays("2026-09-01", "2026-09-09") === 8`;
   `dueDateSpanDays("2026-09-09", "2026-09-01") === 0` (never negative);
   `dueDateSpanDays("2026-09-01", "2026-09-01") === 0`.
2. `canConvertProforma(invoice)` returns `{ ok: true }` only for
   `documentType === "proforma"` with `status !== "cancelled"`; returns
   `{ ok: false, reason: "notProforma" }` for `invoice`/`advance`/`storno`/
   `modify`, and `{ ok: false, reason: "cancelled" }` for a cancelled proforma.
3. `buildInvoiceFromProforma(proforma, "2026-09-15")` returns an invoice with
   `documentType === "invoice"`, `status === "draft"`, `invoiceNumber === ""`,
   a **new** `id`, and `convertedFromInvoiceId === proforma.id`.
4. The same call sets `issueDate === "2026-09-15"` and
   `dueDate === "2026-09-23"` for a source whose issue/due dates were
   `2026-09-01` / `2026-09-09` (8-day span re-based on today).
5. It copies `clientId`, `clientName`, `clientTaxNumber`, `currency`,
   `exchangeRate` and `paymentMethod` unchanged, and clears `paidAt`,
   `paidAmount`, `originalInvoiceId`, `modifiesInvoiceId`,
   `modificationIndex` (all `undefined`).
6. Every line item is copied field-for-field (`description`, `quantity`,
   `unitPrice`, `vatRate`, `vatCategory`, `vatExemptionReason`, `unit`) with a
   **new** `id` that differs from the source line's id.
7. `notes` for a source with notes `"Előleg"` and number `DBK-2026-00001`
   becomes `"Előleg\nDíjbekérő alapján: DBK-2026-00001"`; for a source with no
   notes it is exactly `"Díjbekérő alapján: DBK-2026-00001"`.

**Service — `lib/invoices/service.ts`**

8. `convertProformaToInvoice(userId, proforma)` persists the built draft via
   `upsertInvoice` and resolves to the saved invoice with
   `convertedFromInvoiceId` set; no document number is allocated (the
   numbering upsert is never called, because the row is a `draft`).
9. `findExistingConversion(userId, proformaId)` returns the non-cancelled
   invoice whose `convertedFromInvoiceId` is `proformaId`, and `null` when the
   only match has `status === "cancelled"`.
10. `findInvoicesReferencing(userId, "convertedFromInvoiceId", id)` queries the
    `convertedFromInvoiceId` column (the existing `originalInvoiceId` /
    `modifiesInvoiceId` behaviour is unchanged).

**API — `POST /api/invoices/[id]/convert`**

11. Returns 401 with no session; 404 when the id does not belong to the user.
12. Returns 400 `{ code: "notProforma" }` when the document is not a
    díjbekérő, and 400 `{ code: "cancelled" }` for a cancelled díjbekérő —
    `convertProformaToInvoice` is not called in either case.
13. Returns 201 `{ invoice }` for a valid díjbekérő, where
    `invoice.documentType === "invoice"` and `invoice.status === "draft"`.
14. Returns 409 `{ code: "alreadyConverted", invoice }` — carrying the
    **existing** invoice — when a non-cancelled conversion already exists, and
    creates nothing.

**API — `GET /api/invoices/[id]/links`**

15. The response additionally carries `convertedFromInvoice` (the díjbekérő
    this invoice was made from, or `null`) and `convertedToInvoices` (array,
    possibly empty). The four existing keys (`originalInvoice`,
    `modifiesInvoice`, `stornoDocuments`, `correctionDocuments`) are unchanged.

**Storno/helyesbítő guards**

16. `POST /api/invoices/[id]/storno` and `POST /api/invoices/[id]/modify`
    return 400 for `documentType === "proforma"` and never allocate a number.

**UI — invoice detail (`app/(app)/invoices/[id]/index.tsx`)**

17. For a díjbekérő with no conversion yet, the single solid primary action
    reads `t("invoices.convert.action")` ("Számla készítése ebből"); pressing
    it POSTs to `/api/invoices/{id}/convert` and routes to
    `routes.invoiceEdit(<new id>)`.
18. For a díjbekérő that already has a live conversion, the primary action
    reads `t("invoices.convert.openExisting")` and routes to
    `routes.invoiceDetail(<existing id>)` without POSTing anything.
19. On a díjbekérő, the overflow menu's "Helyesbítő számla" entry is disabled
    and the DangerZone shows only "Törlés" (no "Sztornó").
20. The "Kapcsolódó bizonylatok" card renders
    `t("invoices.links.convertedTo", { number })` on the díjbekérő and
    `t("invoices.links.convertedFrom", { number })` on the invoice, each
    navigating to the other document's detail screen.

**UI — invoice list row menu (`app/(app)/invoices/index.tsx`)**

21. A row whose `documentType === "proforma"` gets one extra overflow-menu
    entry, `t("invoices.convert.action")`, running the same conversion +
    navigate flow; non-proforma rows do not get it.

**Cross-cutting**

22. Every new user-visible string exists in **both** `lib/i18n/locales/hu.ts`
    and `lib/i18n/locales/en.ts` under the same key path (§6), and the
    existing i18n parity test stays green.
23. `npx tsc --noEmit` clean and `npm run test:unit` green.

---

## 4. Files to touch

| File | Change |
|------|--------|
| `db/schema.ts` | **ADDITIVE**: `convertedFromInvoiceId` column + index on `invoice` (§7) |
| `drizzle/` | `npx drizzle-kit generate` output (generate only — never `db:push`) |
| `lib/invoices/types.ts` | `convertedFromInvoiceId?: string` on `Invoice` |
| `lib/invoices/mappers.ts` | map the new column both directions (`?? undefined` / `?? null`) |
| `lib/invoices/convert-proforma.ts` | **new** — pure `dueDateSpanDays`, `canConvertProforma`, `buildInvoiceFromProforma` |
| `lib/invoices/convert-proforma.test.ts` | **new** — AC1–AC7 |
| `lib/invoices/service.ts` | `convertProformaToInvoice`, `findExistingConversion`; widen `findInvoicesReferencing`'s field union |
| `lib/invoices/service.test.ts` | extend — AC8–AC10 (add `convertedFromInvoiceId: null` to `dbInvoiceRow`) |
| `app/api/invoices/[id]/convert+api.ts` | **new** — AC11–AC14 |
| `app/api/invoices/[id]/convert+api.test.ts` | **new** — AC11–AC14 |
| `app/api/invoices/[id]/links+api.ts` | two extra keys — AC15 |
| `app/api/invoices/[id]/storno+api.ts`, `.../modify+api.ts` | proforma guard — AC16 |
| `app/(app)/invoices/[id]/index.tsx` | primary action, link rows, storno/helyesbítő guards — AC17–AC20 |
| `app/(app)/invoices/index.tsx` | row-menu entry for proforma rows — AC21 |
| `lib/i18n/locales/hu.ts`, `lib/i18n/locales/en.ts` | new keys (§6) |
| `__tests__/fixtures/invoices.ts` | only if `makeInvoice` needs the new optional field |
| `docs/loop-queue.md` | mark the item done in the ship commit, not here |

---

## 5. Tests to write first (TDD)

Write these **before** any implementation; each must fail for the right
reason first.

1. **`lib/invoices/convert-proforma.test.ts`** (no mocks beyond `@/lib/id`,
   mocked the way `service.test.ts` already does it so the new ids are
   deterministic): AC1–AC7. Start with AC3 (the builder does not exist yet),
   then AC1/AC2, then the copy/clear/notes cases.
2. **`lib/invoices/service.test.ts`** — new `describe("convertProformaToInvoice")`
   next to the existing storno/modify blocks, reusing `mockSelectQueue` and
   `dbInvoiceRow`: AC8, AC9, AC10. Assert explicitly that
   `mockSequenceQueue` is untouched (no number burned).
3. **`app/api/invoices/[id]/convert+api.test.ts`** — copy the mock header of
   `app/api/invoices/[id]/preview+api.test.ts` (`@/lib/api/session`,
   `@/lib/api/resolve-id-param`, `@/lib/invoices/service`): AC11, AC12
   (both reasons), AC13, AC14. In the 409 case assert
   `convertProformaToInvoice` was **not** called.
4. Only after 1–3 are red→green: the UI wiring (AC17–AC21). The detail and
   list screens have no unit tests today, so do not invent a screen test
   harness for them in this slice — cover them by keeping all branching logic
   in the pure helpers of `convert-proforma.ts` (`canConvertProforma`) and
   verifying the screens by hand at both breakpoints (§9). Note the manual
   check results in the PR body.

---

## 6. i18n keys (hu + en)

New block `invoices.convert`:

| key | hu | en |
|-----|----|----|
| `invoices.convert.action` | `Számla készítése ebből` | `Create invoice from this` |
| `invoices.convert.openExisting` | `Számla megnyitása` | `Open the invoice` |
| `invoices.convert.created` | `Számla piszkozat elkészült a díjbekérőből.` | `Invoice draft created from the proforma.` |
| `invoices.convert.failed` | `A számla létrehozása a díjbekérőből sikertelen.` | `Could not create the invoice from the proforma.` |
| `invoices.convert.alreadyConverted` | `Ebből a díjbekérőből már készült számla: {{number}}` | `An invoice was already created from this proforma: {{number}}` |
| `invoices.convert.notProforma` | `Csak díjbekérőből lehet számlát készíteni.` | `Only a proforma can be converted into an invoice.` |
| `invoices.convert.cancelledSource` | `Törölt díjbekérőből nem készíthető számla.` | `A cancelled proforma cannot be converted.` |

Added to the existing `invoices.links` block:

| key | hu | en |
|-----|----|----|
| `invoices.links.convertedTo` | `Ebből készült számla: {{number}}` | `Invoice created from this: {{number}}` |
| `invoices.links.convertedFrom` | `Díjbekérő alapján: {{number}}` | `Based on proforma {{number}}` |

Added to `invoices.errors` (used by the storno/helyesbítő guards, AC16/AC19):

| key | hu | en |
|-----|----|----|
| `invoices.errors.proformaNotStornoable` | `A díjbekérő nem adóügyi bizonylat — nem sztornózható és nem helyesbíthető. Töröld, vagy készíts belőle számlát.` | `A proforma is not an accounting document — it cannot be cancelled or corrected. Delete it, or convert it into an invoice.` |

The one string that is **not** an i18n key is the appended notes line
(`Díjbekérő alapján: …`, §2e) — it is document content written into the
database, exactly like the existing `Sztornó – eredeti bizonylat: …` and
`Helyesbítő – eredeti bizonylat: …` strings, and follows the same
always-Hungarian rule as `lib/invoices/document-labels.ts`.

---

## 7. db/schema.ts changes — **ADDITIVE**

One nullable self-referencing column plus its index on the `invoice` table:

```ts
/** Set on a számla created from a díjbekérő; points back at the proforma. */
convertedFromInvoiceId: text("converted_from_invoice_id").references(
  (): AnyPgColumn => invoice.id,
  { onDelete: "set null" }
),
```

and in the table's index list:

```ts
index("invoice_converted_from_invoice_id_idx").on(table.convertedFromInvoiceId),
```

**ADDITIVE** — a new nullable column and a new index, no DROP, no rename, no
type change, no data movement. Every existing row keeps working with `NULL`.
The implementer runs `npx drizzle-kit generate` and commits the migration;
`db:push` belongs to the Ship phase only, per CLAUDE.md. Remember to add
`convertedFromInvoiceId: null` to `dbInvoiceRow()` in `lib/invoices/service.test.ts`.

---

## 8. Risk classification

**`schema`** — one additive nullable column + index (§7).

Reasoning for why it is *not* the other categories:

- **not `tax-legal`**: nothing under `lib/tax/`, no tax figure, no rate, no
  deadline, no marketing or compliance claim. The two guards this slice adds
  (§1a/§1b) *remove* a numbering hazard rather than introducing a tax
  judgement, and the notes/link strings are document references, not legal
  copy. The one piece of genuinely compliance-flavoured copy that belongs on a
  díjbekérő — the "ez a bizonylat nem számla, áfa levonására nem jogosít"
  disclaimer printed on the document itself — is deliberately **out of scope**
  (§10) so this slice does not get gated on it.
- **not `nav-production`**: no NAV client, environment, credential, XML or
  default is touched; the converted draft reaches NAV only through the
  existing, explicit composer toggle (§1).

Ship conditions: `npx tsc --noEmit` clean, `npm run test:unit` green, no
confirmed high/medium review finding, and the generated migration inspected
to confirm it contains only `ADD COLUMN` + `CREATE INDEX` before `db:push`.

---

## 9. UX notes

**Mobile (375px).**
- The díjbekérő's primary action is the *one* solid button in
  `InvoiceMoneyHeader`'s `primaryAction` slot — "Számla készítése ebből" fits
  on one line at 375px; if it wraps, let it wrap rather than truncating, and
  do not shrink the button below the 44px tap target (the queue's open
  tap-target item applies here too — the new row-menu entry inherits
  `OverflowMenu`'s existing sizing, so nothing new is introduced).
- "Fizetettnek jelölés" stays in the secondary slot for a díjbekérő (an EV
  does record that the díjbekérő was paid before issuing the számla), so the
  header keeps its existing one-solid-plus-outline-plus-overflow shape.
- Link rows in "Kapcsolódó bizonylatok" are already full-width pressables;
  the two new rows follow the same `Text size="sm" className="text-primary"`
  pattern. Keep the whole row pressable, not just the number.
- Feedback after conversion: on success the screen navigates straight to the
  prefilled edit composer, which is its own confirmation — no toast needed on
  the detail screen it just left. `invoices.convert.created` is used as the
  composer-bound success message only if the navigation is deferred; the
  **error** paths (400/409) are what render into the detail screen's existing
  `message` card.

**Desktop (≥768px).**
- Same single primary action; no new row of buttons. The sidebar/notification
  layout is untouched.
- The 409 case must not look like a failure: it swaps the primary action to
  "Számla megnyitása" and shows the existing invoice as a link row, so a
  double-click on a slow connection resolves into "here is the invoice you
  already made", not an error toast.
- Busy state: reuse the existing `runAction("convert", …)` + `busy` pattern so
  the button disables while the POST is in flight (prevents the double-submit
  that the 409 guard is the server-side backstop for).

---

## 10. Out of scope

- **New `InvoiceStatus`** for a converted/"számlázva" díjbekérő (§2g) — file
  as a follow-up queue item.
- **The díjbekérő document disclaimer** ("Ez a bizonylat nem számla, áfa
  levonására nem jogosít") on the HTML preview and PDF. Genuinely wanted, but
  it is compliance copy on an outgoing document → tax/legal-gated → its own
  slice, so this one can ship normally. File as a follow-up queue item marked
  *needs tax/legal sign-off*.
- **Előleg (ELO-) / advance-invoice flow.** `advance` already has its own
  sequence but no flow either; the díjbekérő→számla relationship (a collection
  request that becomes an invoice) and the előlegszámla→végszámla relationship
  (a *reported* advance invoice that must be deducted from the final invoice's
  base) are different problems with different NAV consequences. Separate item.
- **Partial conversion** (invoicing only some lines of a díjbekérő, or
  several díjbekérős into one számla).
- **Carrying the recorded payment across.** The converted invoice starts
  unpaid; automatically marking it paid because the díjbekérő was paid is a
  Phase 2 bank-matching decision, not a Phase 1 copy operation.
- **Backfilling `convertedFromInvoiceId`** for invoices that were hand-retyped
  from a díjbekérő before this slice — unknowable, and not worth a heuristic.
- **Email templates** `proforma_notification` / `proforma_reminder` and the
  raw-English template-type labels (already a separate audit finding).
- **Any NAV submission behaviour change**, including auto-submitting the
  converted invoice.
