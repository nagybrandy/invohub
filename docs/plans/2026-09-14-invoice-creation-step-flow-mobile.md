# Plan — Invoice creation: sectioned/collapsible flow on mobile

- Backlog item: Phase 1 — Core invoicing, NAV-compliant. Owner priority #1
  ("Invoice creation flow: step/accordion flow on mobile, fewer fields before
  line items").
- Slug: `invoice-creation-step-flow-mobile`
- Branch: `slice/invoice-creation-step-flow-mobile`
- Date: 2026-09-14
- Risk: **none** (see §8)

---

## 1. Goal and user value

`app/(app)/invoices/new.tsx` today renders, on a 375px screen, a single flat
scroll: breadcrumb → title → 4 document-type tabs → **7 recipient fields** →
**8–9 dates/payment fields** → only then "Mit számlázol?" (the line items).
Measured from the code: roughly 1.5–2 full screen heights of scrolling before
an EV can type what they are actually invoicing.

That ordering is backwards for the real job. The overwhelmingly common case for
an egyéni vállalkozó is: pick a partner they have already invoiced, keep today's
date, keep the 8-day deadline, keep transfer + HUF, and type one line item. Every
one of those dates/payment fields already has a correct default (`todayIso()`,
`addDaysIso(8)`, `transfer`, `HUF`, bank account prefilled from the company
profile) — the user scrolls past nine controls only to change nothing.

**Product decision (this is the "product/design decision" the backlog deferred):
accordion, not a wizard.** A 3-step wizard would *add* taps and a back/next state
machine to the common path and would hurt the desktop two-column layout that
already works. Instead, on mobile each section becomes a collapsible card with a
one-line summary of its current values, and the sections whose defaults are
already right start **collapsed**:

| Section | Mobile initial state | Collapsed summary shows |
|---|---|---|
| Kinek szól a bizonylat? (recipient) | open | partner name · city · tax number |
| Dátumok és fizetés | **collapsed** | `2026-09-14 · Átutalás · 8 nap · HUF` |
| Mit számlázol? (line items) | open | — (never collapsed to a summary in the initial state) |
| További beállítások | collapsed (unchanged) | — |

Inside the recipient section, the less-common partner fields (country, tax
number, zip, city, address, email) move behind a **"Partner további adatai"**
disclosure, so a saved partner needs exactly one tap (the partner chip) and no
scrolling.

Result on 375px: document tabs → partner picker → collapsed dates summary →
line items, all within roughly one screen. Everything stays reachable in one tap;
nothing is removed; desktop (≥768px) is unchanged — every section renders open,
two-column, with no chevrons.

### Compliance guard (deliberate, do not simplify away)

Hiding the buyer tax number and address could cause a missing mandatory field on
a domestic B2B invoice (Áfa tv. 169. §). So the "Partner további adatai" block
**auto-expands** whenever the partner was typed manually rather than picked from
the saved-partner chips (`clientName` non-empty **and** `clientId === null`) —
exactly the case where those details still have to be entered. For a saved
partner the data already came from the client record, so it stays collapsed and
is shown in the summary line.

---

## 2. Acceptance criteria (testable, numbered)

1. `initialOpenSections(false)` (mobile) returns `recipient: true`,
   `datesPayment: false`, `lineItems: true`, `advanced: false`.
2. `initialOpenSections(true)` (desktop) returns `recipient`, `datesPayment`
   and `lineItems` all `true`, `advanced: false`.
3. On a 375px render of `app/(app)/invoices/new.tsx`, the "Dátumok és fizetés"
   section's body is **not** mounted initially (no `invoices.fields.currency`
   / `invoices.fields.paymentDeadline` label in the tree), while
   `invoices.sections.lineItems` **is** present.
4. On a 375px render, tapping the "Dátumok és fizetés" header mounts its body
   (the `invoices.fields.currency` label appears) and tapping it again unmounts
   it.
5. On a ≥768px render, all three main section bodies are mounted at once and no
   section header is pressable (desktop renders `collapsible={false}`), i.e. the
   current desktop two-column layout is preserved.
6. `datesPaymentSummary({ issueDate: "2026-09-14", deadlineDays: 8,
   paymentMethodLabel: "Átutalás", currency: "HUF", daysLabel: "nap" })`
   returns `"2026-09-14 · Átutalás · 8 nap · HUF"`.
7. `recipientSummary` returns `null` for an empty/whitespace `clientName` (the
   screen then renders `invoices.sections.recipientSummaryEmpty`), and joins
   only the non-empty of name / city / tax number with `" · "` otherwise.
8. `shouldExpandPartnerDetails` returns `true` when `clientName` is non-empty
   and `clientId` is `null`; `false` when a saved partner is selected
   (`clientId` set); `false` for an empty name; and `true` whenever
   `forced === true`, regardless of the other inputs.
9. Submitting with an empty partner name on mobile sets the existing
   `invoices.errors.clientRequired` error **and** leaves/forces the recipient
   section open; submitting with no line-item description forces the line-items
   section open; the existing `emailOnSend` + missing-email path forces the
   recipient section **and** its partner-details block open (today it only
   opens `showAdvanced`, where the email field no longer lives).
10. `FormSection` renders `accessibilityRole="button"` and
    `accessibilityState={{ expanded }}` on its header when collapsible, renders
    the summary text only while collapsed, and its header carries a
    `min-h-[44px]` class (tap-target minimum).
11. Saving still produces the same `Invoice` payload as before for the same
    inputs — no field, default, `composeInvoiceNotes` input or NAV/email
    side-effect changes. Asserted by a screen test that fills partner + one line
    item on mobile and checks `addOrUpdate` was called with the unchanged shape.
12. Every new user-visible string has a key in **both** `lib/i18n/locales/hu.ts`
    and `lib/i18n/locales/en.ts`; `lib/i18n/locales/en.test.ts`'s parity test
    passes.
13. `npm run typecheck` and `npm run test:unit` pass with no new warnings.

---

## 3. Files to touch

| File | Change |
|---|---|
| `components/invoices/FormSection.tsx` | **New.** Collapsible section card (Card + header + optional summary + chevron). Props: `icon`, `iconColor`, `title`, `summary?`, `open`, `onToggle`, `collapsible`, `className?`, `children`. When `collapsible === false` it renders the current always-open `SectionHeader` + body with no Pressable and no chevron. Header: `min-h-[44px]`, `accessibilityRole="button"`, `accessibilityState={{ expanded }}`. Body is conditionally **mounted** (not just hidden) so collapsed fields cost nothing on mobile. |
| `components/invoices/FormSection.test.tsx` | **New.** AC 10 + toggle behaviour. |
| `lib/invoices/new-invoice-form-sections.ts` | **New.** Pure helpers, no React: `SectionId`, `initialOpenSections(isDesktop)`, `recipientSummary(fields): string \| null`, `datesPaymentSummary(parts): string`, `shouldExpandPartnerDetails({ clientId, clientName, forced })`, `sectionForValidationError(kind)`. |
| `lib/invoices/new-invoice-form-sections.test.ts` | **New.** AC 1, 2, 6, 7, 8. |
| `app/(app)/invoices/new.tsx` | Replace the three hand-rolled `Card` + `SectionHeader` blocks and the ad-hoc "További beállítások" `Pressable` with `FormSection`. Add `openSections` state seeded from `initialOpenSections(isDesktop)` and a `partnerDetailsOpen` state. Move country/taxNumber/zip/city/address/email into the partner-details disclosure. Point the three validation branches in `handleSave` at `sectionForValidationError`. **No change** to state names, defaults, effects, `composeInvoiceNotes`, `buildDraftInvoice`, the save payload, the preview branch or the sticky footer. |
| `__tests__/screens/invoice-new.test.tsx` | **New.** AC 3, 4, 5, 9, 11. |
| `lib/i18n/locales/hu.ts`, `lib/i18n/locales/en.ts` | New keys in §5. |
| `e2e/web/invoices.spec.ts` | The authenticated specs assert "Teljesítés dátuma" / "Fizetési mód" / "Pénznem" / "Fizetési határidő" / "Irányítószám" / "Város" / "Ország" / "Adószám" are visible, and the suite also runs a Pixel 7 project. Add a small `openSection(page, title)` helper that clicks the section header when the field is not already visible, and call it in the dates/payment and recipient specs. (These specs are skipped without `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`, but must not be left silently wrong.) |
| `docs/loop-queue.md` | Flip the item to `[x]` at the end of the slice if every criterion is met. |

Explicitly **not** touched: `components/invoices/LineItemEditor.tsx`,
`DocumentTypeTabs.tsx`, `InvoiceDocumentPreview.tsx`, `hooks/`, `db/schema.ts`,
any `lib/nav/**` or `lib/tax/**` file, and the invoice **edit** screen.

---

## 4. Tests to write first (TDD)

Write these before the implementation; each must fail first.

`lib/invoices/new-invoice-form-sections.test.ts`
1. `initialOpenSections(false)` → `{ recipient: true, datesPayment: false, lineItems: true, advanced: false }`.
2. `initialOpenSections(true)` → `{ recipient: true, datesPayment: true, lineItems: true, advanced: false }`.
3. `datesPaymentSummary` → `"2026-09-14 · Átutalás · 8 nap · HUF"` (AC 6).
4. `datesPaymentSummary` with `currency: "EUR"` ends in `"EUR"`.
5. `recipientSummary({ clientName: "  " })` → `null`.
6. `recipientSummary({ clientName: "Minta Kft.", clientCity: "", clientTaxNumber: "12345678-1-23" })` → `"Minta Kft. · 12345678-1-23"` (empty parts dropped, no double separator).
7. `shouldExpandPartnerDetails` — the four cases in AC 8.
8. `sectionForValidationError("client") === "recipient"`,
   `("lineItem") === "lineItems"`, `("clientEmail") === "recipient"`.

`components/invoices/FormSection.test.tsx` (mock `@/components/ui/*` with
`__tests__/mocks/gluestack-ui`, `lucide-react-native` with the `View` Proxy —
same pattern as `__tests__/screens/invoice-edit.test.tsx`)
9. `collapsible` + `open={false}`: children are **not** in the tree, `summary`
   text **is**, header has `accessibilityState.expanded === false`.
10. `collapsible` + `open`: children are in the tree, `summary` is **not**
    rendered, `accessibilityState.expanded === true`.
11. Pressing the header calls `onToggle` exactly once.
12. `collapsible={false}`: children render, no element with
    `accessibilityRole === "button"` exists in the header, `onToggle` is never
    called.
13. The header's `className` contains `min-h-[44px]`.

`__tests__/screens/invoice-new.test.tsx` — copy the mock block from
`__tests__/screens/invoice-edit.test.tsx` (expo-router, react-i18next `t = key`,
lucide Proxy, `@/lib/api/client`, `@/hooks/useInvoices`, `@/hooks/useCompany`,
`@/hooks/useClients`, the gluestack mocks, `LineItemEditor` and
`InvoiceDocumentPreview` stubbed to `null`). Control the breakpoint with
`jest.spyOn(Dimensions, "get").mockReturnValue({ width, height: 812, scale: 2, fontScale: 2 })`
in a `beforeEach` (fall back to a `jest.mock("react-native", …requireActual…)`
partial mock if the preset's `useWindowDimensions` does not pick it up).

14. width 375: no `invoices.fields.currency` label in the tree;
    `invoices.sections.lineItems` is present (AC 3).
15. width 375: press the `invoices.sections.datesPayment` header → the
    `invoices.fields.currency` label appears; press again → gone (AC 4).
16. width 375: `invoices.fields.taxNumber` is absent initially; typing into the
    partner-name field (no chip selected) makes it appear (partner-details
    auto-expand, AC 8 wired through).
17. width 1024: `invoices.fields.currency`, `invoices.fields.taxNumber` and
    `invoices.sections.lineItems` are all present without any press (AC 5).
18. width 375: press "Számla elkészítése" with everything empty →
    `invoices.errors.clientRequired` rendered, `addOrUpdate` not called, the
    recipient section still open (AC 9).
19. width 375: fill partner name + one line item (via the stubbed
    `LineItemEditor`'s `onChange`) → `addOrUpdate` called once with
    `invoiceNumber: ""`, `documentType: "invoice"`, `status: "sent"`,
    `currency: "HUF"`, the typed `clientName`, and `lineItems.length === 1`
    (AC 11).

---

## 5. i18n keys (hu + en)

New keys only — no existing key changes value.

| Key | hu | en |
|---|---|---|
| `invoices.sections.partnerDetails` | `Partner további adatai` | `More partner details` |
| `invoices.sections.recipientSummaryEmpty` | `Nincs partner kiválasztva` | `No partner selected` |
| `invoices.sections.partnerDetailsSummaryEmpty` | `Cím, adószám, e-mail` | `Address, tax number, email` |
| `invoices.sections.expand` | `Kinyitás` | `Expand` |
| `invoices.sections.collapse` | `Összecsukás` | `Collapse` |

Reused as-is: `invoices.sections.recipient`, `invoices.sections.datesPayment`,
`invoices.sections.lineItems`, `invoices.sections.additionalSettings`,
`invoices.fields.days` (`"nap"` / `"days"` — passed into `datesPaymentSummary`
as `daysLabel`), `invoices.paymentMethods.*`, and every existing field label.

`invoices.sections.expand` / `collapse` are used only as the chevron's
`accessibilityHint`; no visible text is added to the header beyond title +
summary. The parity test in `lib/i18n/locales/en.test.ts` covers AC 12 with no
change needed there.

---

## 6. `db/schema.ts` changes

**None.** No table, column or index is added, renamed or dropped — this slice is
presentation-only and the saved `Invoice` payload is byte-identical (AC 11).
Nothing to `drizzle-kit generate`, nothing for `db:push`.

(Not ADDITIVE and not DESTRUCTIVE: there is no schema change at all.)

---

## 7. UX notes

### Mobile (375px)

- Above the fold after the tabs: partner name input + saved-partner chips, the
  collapsed "Dátumok és fizetés" summary row, and the start of the line-items
  editor. Pre-line-items scroll drops from ~16 controls to ~2.
- Section headers are full-width, `min-h-[44px]`, with the chevron on the right
  and the summary as a second, `text-xs text-muted-foreground` line beneath the
  title while collapsed.
- The collapsed dates summary is real data, not a placeholder: it re-renders as
  the user changes the deadline chips or currency, so a user who never opens the
  section can still verify `2026-09-14 · Átutalás · 8 nap · HUF` at a glance.
- Collapsing **unmounts** the body, so the `KeyboardAvoidingView` no longer has
  to keep nine off-screen inputs alive; keep `keyboardShouldPersistTaps="handled"`
  and the `pb-52` footer clearance exactly as they are.
- Validation never hides its own cause: a failed save expands the offending
  section before the error text renders (AC 9).
- The existing "További beállítások" block keeps its position and behaviour; it
  is only re-expressed through `FormSection` so there is one pattern, not two.
- Chevron/pill tap targets elsewhere on this screen (payment method, currency,
  deadline, VAT pills) are **not** resized here — that is the separate shared
  "choice pill" backlog item.

### Desktop (≥768px)

- No visible change. `collapsible={false}` makes every section render open with
  the current `SectionHeader`, keeping the `flex-row gap-6` two-column recipient
  / dates-payment layout, the full-width line-items card, and the sticky footer.
- Partner details are **not** behind a disclosure on desktop — the recipient card
  renders all its fields as today, since there is no scroll cost there.
- The preview branch (`showPreview`) and its "Vissza a szerkesztéshez" button are
  untouched on both breakpoints.

---

## 8. Risk classification

**`none`.**

Reason: the change is confined to one screen's presentation plus two new
presentation-layer files. It touches no `lib/tax/**`, no `lib/nav/**`, no
`lib/m2m/**`, no marketing copy and no compliance claim; it makes no network call
that did not exist before and does not change the NAV submit or email-send
branches. It does not change `db/schema.ts`, so there is nothing for `db:push`.
The saved invoice payload is asserted unchanged (AC 11). Eligible for auto-ship
once typecheck + unit tests are green and no high/medium finding stands.

The one compliance-adjacent aspect — hiding the buyer tax number/address behind a
disclosure — is mitigated by the auto-expand rule in §1 and covered by AC 8 and
test 16; it changes visibility only, never validation or the emitted data.

---

## 9. Out of scope

- A true multi-step wizard with next/back navigation — rejected above; if the
  owner still wants one, file it as a new item.
- Shared ≥44px "choice pill" component for VAT / payment-method / currency /
  deadline / filter pills — its own Phase 1 backlog item.
- Notification-bell tap target in `components/navigation/MobileAppHeader.tsx` —
  its own Phase 1 backlog item.
- The same treatment for `app/(app)/invoices/[id]/edit.tsx` and
  `app/(app)/receipts/new.tsx` — follow-up items once this pattern is proven.
- Real date pickers for `fulfillmentDate` / `issueDate` (still free-text
  `ÉÉÉÉ-HH-NN` inputs), and the `continuousPerformance` switch's currently
  cosmetic behaviour — both are their own product items.
- Persisting `fulfillmentDate` as a first-class `Invoice` field instead of only
  composing it into `notes` — a schema + NAV-XML change, not a UX change.
- Non-HUF `exchangeRate` flowing into the NAV XML / PDF HUF VAT base — owner
  priority #2, a separate slice.
- Autosave semantics: the `invoices.autoSavedAt` indicator is still cosmetic
  (nothing is persisted); not fixed or removed here.
- Any change to the authenticated E2E fixture — blocked on the Phase 0 auth
  test-user item; this slice only keeps the existing specs consistent with the
  new DOM.
