# Plan — Invoice-flow tap targets: shared choice pill + notification bell ≥44px

Slug: `invoice-flow-tap-targets-44px`
Branch (created later by Build, in its own worktree): `slice/invoice-flow-tap-targets-44px`
Phase: 1 — Core invoicing, NAV-compliant
Date: 2026-09-18
Risk: **none** (pure presentation + one dead-control fix; no `lib/tax/`, no
NAV/M2M behaviour, no tax figure, no marketing copy, no schema change)

---

## 0. What is actually still broken (verified against current code)

The queue entry says this item is "partially shipped". Verified today:

| Where | Current | Effective height |
|---|---|---|
| `components/navigation/MobileAppHeader.tsx:71` bell | `Pressable className="relative rounded-full p-2.5"` + `<Bell size={22}>` | 10 + 22 + 10 = **42px** |
| `components/invoices/composer/VatCategoryPicker.tsx:37,83` category pills | `px-2.5 py-1.5` + `size="xs"` text | ≈ **28px** |
| `VatCategoryPicker.tsx:54` VAT-rate pills (27/18/5/0) | `px-2 py-1` + `size="2xs"` text | ≈ **22px** |
| `VatCategoryPicker.tsx:66` "Speciális adózás" toggle | bare text row, no padding | ≈ **18px** |
| `composer/StepPartner.tsx:248` deadline quick-pick (8/15/30 nap) | `px-3 py-1` + `size="xs"` | ≈ **24px** |
| `composer/StepPartner.tsx:271` payment-method pills | `px-3 py-1.5` + `size="sm"` | ≈ **32px** |
| `composer/StepPartner.tsx:289` currency pills (HUF/EUR) | `px-3 py-1.5` + `size="sm"` | ≈ **32px** |
| `app/(app)/invoices/index.tsx:279` status filter chips | `px-3 py-1.5` + `size="xs"` | ≈ **28px** |
| `components/invoices/DocumentTypeTabs.tsx:41` | `py-2.5` + `text-sm` | ≈ **40px** |
| `components/invoices/ScreenModeTabs.tsx:28` | `py-2` + `size="sm"` | ≈ **36px** |
| `components/invoices/composer/ComposerStepper.tsx:33` step tabs | no vertical padding, 24px badge | ≈ **24px** |
| `components/i18n/LanguageSwitcher.tsx:56` | `min-h-9` + `hitSlop={8}` | **36px** visual (52px touch) |

Two findings the queue entry does not mention, both worth fixing here because
they sit inside the same lines of code:

1. **`app/(app)/invoices/index.tsx:294` renders a dead control.** The
   "Egyéb (n)" chip is a `Pressable` styled exactly like the real filter
   chips but has **no `onPress`**. An EV taps it, nothing happens, and there
   is no way to tell it apart from the working chips. (`other` comes from
   `useInvoiceStatusCounts.ts:58` = `allCount − known`, i.e. proforma /
   partially_paid / cancelled — it is an informational remainder, not a
   filter. It must stop looking like a button.)
2. **The queue entry's file reference is stale.** The VAT pills it names live
   in `components/invoices/LineItemEditor.tsx`, which is **dead code** —
   `grep -rn LineItemEditor` outside its own test and old docs returns
   nothing; the composer rewrite replaced it with
   `composer/LineItemRow.tsx` + `composer/VatCategoryPicker.tsx`. The live
   VAT pills are in `VatCategoryPicker.tsx`. Deleting the dead file is
   **out of scope** (see §8) — it just must not be "fixed" instead of the
   real one.

## 1. Goal and user value

An egyéni vállalkozó issues invoices on a phone, often one-handed, often in
a hurry. Every mis-tap in the composer is either a wrong VAT category (a
compliance problem, not a cosmetic one — AAM vs. 27% on the wrong line) or a
wrong payment deadline. Today the most consequential choices in the whole app
— **ÁFA kezelés, fizetési mód, pénznem, fizetési határidő** — are the
*smallest* things on the screen, at 22–32px, while the "Következő" button is
comfortably large.

After this slice:

1. Every inline choice in the invoice flow is a ≥44px target (Apple HIG /
   WCAG 2.5.8 AAA), so picking "AAM" instead of "Adóköteles" takes one
   deliberate tap, not a careful one.
2. Those choices stop being ad-hoc `Pressable + className` copies. One
   `ChoicePill` primitive owns the height floor, the selected/unselected
   tokens and the accessibility role, so the next picker someone adds is
   correct by construction instead of by review.
3. Nothing in the invoice list looks tappable while doing nothing.
4. Screen readers announce the pills as a selectable choice
   (`accessibilityRole="radio"` + `accessibilityState.selected`) and the
   bell announces how many unread notifications there are.

## 2. Design — one primitive, one source of truth

**`lib/ui/tap-target.ts`** (new, ~10 lines):

```ts
/** Minimum interactive target, in px (Apple HIG 44pt / WCAG 2.5.8 AAA). */
export const MIN_TAP_TARGET_PX = 44;
/** Tailwind/NativeWind class for that floor: h-11 = 2.75rem = 44px. */
export const TAP_TARGET_MIN_H = "min-h-11";
/** Square icon-button target (bell, row actions). */
export const TAP_TARGET_ICON_BOX = "h-11 w-11 items-center justify-center";
```

`min-h-11` is already proven in this repo (`components/marketing/LandingHeader.tsx:160`).

**`components/ui/choice-pill/index.tsx`** (new, ~55 lines):

```tsx
type ChoicePillProps = {
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;        // usually <Text>
  accessibilityLabel?: string;
  accessibilityRole?: "radio" | "tab" | "button";  // default "radio"
  testID?: string;
  /** Extra layout classes from the caller (width, rounding, flex). */
  className?: string;
};
```

Rules the implementer must follow:

- Composition is a **plain template literal**, in this order:
  `base → selected/unselected tokens → caller className → TAP_TARGET_MIN_H`.
  **Do not use `tva()` here.** `tva` runs twMerge, and a caller passing
  `py-0.5` / `min-h-0` would silently strip the 44px floor — the exact class
  of bug this item exists to prevent. Put an explanatory comment at the top
  of the file so a reviewer does not "fix" it back to `tva` (this is a
  deliberate, tested departure from AGENTS.md §5).
- Base: `flex-row items-center justify-center rounded-lg border px-3 py-2`.
- Selected: `border-primary bg-primary/10`; unselected:
  `border-border bg-background`; disabled: `opacity-50` and `onPress` not
  called.
- It wraps `@/components/ui/pressable` (RN `Pressable`), **not** a DOM node,
  so **no `.web.tsx` variant is needed** and no `webDomProps` concern arises
  (AGENTS.md §2 only applies to components that render raw `div`/`span`).
- Also export a thin `ChoicePillGroup` = `HStack` with
  `accessibilityRole="radiogroup"`, `space="sm"`, `className="flex-wrap"`,
  so a wrapped row keeps a consistent 8px gap at 44px row height.

Then **replace every ad-hoc pill listed in §0 with `ChoicePill`**. Tabs pass
`accessibilityRole="tab"` and keep their own width classes
(`w-1/3 md:flex-1`, `flex-1`).

## 3. Acceptance criteria (numbered, testable)

1. `lib/ui/tap-target.ts` exports `MIN_TAP_TARGET_PX === 44` and
   `TAP_TARGET_MIN_H === "min-h-11"`, and every changed component imports the
   floor from there rather than hardcoding a class string.
2. `ChoicePill`'s rendered root `className` always contains `min-h-11` **and**
   `items-center`, including when the caller passes a conflicting className
   (`"py-0.5 min-h-0"` ⇒ the root still ends with `min-h-11`).
3. `ChoicePill` calls `onPress` when pressed, does **not** call it when
   `disabled`, and renders `accessibilityRole="radio"` by default (overridable
   to `"tab"`) with `accessibilityState={{ selected, disabled }}`.
4. `ChoicePill` applies `border-primary bg-primary/10` when `selected` and
   `border-border bg-background` when not — asserted once, in its own test,
   not per call site.
5. `VatCategoryPicker` renders all of its choices — the 2 common categories,
   the 5 advanced ones, and the 4 VAT-rate pills — through `ChoicePill`, so
   every one carries `min-h-11`; the "Speciális adózás" toggle is also a
   ≥44px target. Its four existing behavioural tests pass **unchanged**.
6. `StepPartner`'s deadline quick-pick, payment-method and currency pills
   render through `ChoicePill` (each `min-h-11`) and still call
   `setDeadlineDays` / `setPaymentMethod` / `setCurrency`.
7. The invoice-list status filter chips move into a new
   `components/invoices/InvoiceFilterChips.tsx`, render through `ChoicePill`
   with `min-h-11`, keep their `invoice-filter-<f>` testIDs, and still call
   `onSelect`; `app/(app)/invoices/index.tsx` renders `<InvoiceFilterChips>`
   instead of an inline `FILTERS.map`.
8. The "Egyéb (n)" remainder renders as a **non-interactive** element (no
   `onPress` prop at all) that is visually distinct from the filter chips
   (muted/dashed, not chip-shaped), and still shows the same
   `invoices.list.filterCount` text. Test asserts no node carrying that text
   has an `onPress`.
9. The notification bell in `MobileAppHeader.tsx` renders with
   `TAP_TARGET_ICON_BOX` (`h-11 w-11 items-center justify-center`) plus
   `hitSlop={8}`, and its unread badge stays visually attached to the bell
   glyph — offset **inside** the enlarged box (e.g. `right-1.5 top-1.5`), not
   at the 44px box corner. Test asserts the wrapper className, that the badge
   renders for `unreadCount=3` and the "9+" cap for `unreadCount=12`, and
   that no badge renders for `unreadCount=0`.
10. The bell's `accessibilityLabel` is `nav.notifications` when there is
    nothing unread and the new counted key when `unreadCount > 0`.
11. `DocumentTypeTabs`, `ScreenModeTabs` and `ComposerStepper` each render
    tap rows carrying `min-h-11`, with selection behaviour, testIDs and
    `accessibilityRole="tab"` unchanged.
12. **Regression guard:** display-only badges are *not* enlarged —
    `InvoiceStatusChip` keeps `px-2`/`py-0.5` and its existing test stays
    green. A 44px status chip in a dense list row would be a UX regression,
    not a fix.
13. `lib/i18n/locales/hu.ts` and `en.ts` gain the new keys in both locales;
    the `hu/en` parity test in `lib/i18n/locales/en.test.ts` passes.
14. `npm run typecheck` and `npm run test:unit` are green.

## 4. Tests to write first (TDD order)

Write each failing test, then the smallest change that makes it pass.

1. **`components/ui/choice-pill/index.test.tsx`** (new) — AC2, AC3, AC4.
   Mock `@/components/ui/pressable` and `@/components/ui/text` with
   `@/__tests__/mocks/gluestack-ui` (same pattern as
   `VatCategoryPicker.test.tsx`); render `ChoicePill` for real and assert on
   `props.className` / `props.accessibilityState` / `onPress`.
   Include the "hostile caller className" case explicitly.
2. **`components/invoices/composer/VatCategoryPicker.test.tsx`** (extend) —
   AC5. Add: "every choice is at least a 44px target" — collect all nodes
   with `typeof props.onPress === "function"` (after expanding the advanced
   section) and assert each `className` contains `min-h-11`. Do not touch the
   four existing cases.
3. **`components/invoices/composer/StepPartner.test.tsx`** (extend) — AC6.
   Open the dates/payment section via `composer-toggle-dates-payment`, then
   assert every pill className contains `min-h-11`, and that pressing the
   "30" deadline pill calls `setDeadlineDays(30)`.
4. **`components/invoices/InvoiceFilterChips.test.tsx`** (new) — AC7, AC8.
   Props: `{ filter, onSelect, counts, allCount, otherCount, t }` (keep it
   a pure presentational component — no hooks inside, so it needs no
   `useInvoiceStatusCounts` mock). Assert: 44px on each chip; `onSelect`
   fires with the right status; the "Egyéb" node has no `onPress`; it is
   absent when `otherCount === 0`.
5. **`components/navigation/MobileAppHeader.test.tsx`** (extend) — AC9, AC10.
6. **`components/invoices/DocumentTypeTabs.test.tsx`** (new, small) and
   **`components/invoices/ScreenModeTabs.test.tsx`** (extend) and
   **`components/invoices/composer/ComposerStepper.test.tsx`** (new, small) —
   AC11: each renders `min-h-11` tabs and still calls `onChange`/`onSelect`.
7. `lib/i18n/locales/en.test.ts` parity already covers AC13 — just run it.

Shared helper for the "all pills are 44px" assertion (duplicate the ~6 lines
per test file rather than inventing a test-utils module):

```ts
const pills = tree.root.findAll((n) => typeof n.props?.onPress === "function");
for (const pill of pills) expect(String(pill.props.className)).toContain("min-h-11");
```

## 5. Files to touch

New:
- `lib/ui/tap-target.ts`
- `components/ui/choice-pill/index.tsx` + `index.test.tsx`
- `components/invoices/InvoiceFilterChips.tsx` + `InvoiceFilterChips.test.tsx`
- `components/invoices/DocumentTypeTabs.test.tsx`
- `components/invoices/composer/ComposerStepper.test.tsx`

Changed:
- `components/invoices/composer/VatCategoryPicker.tsx` (+ test)
- `components/invoices/composer/StepPartner.tsx` (+ test)
- `components/invoices/composer/ComposerStepper.tsx`
- `components/invoices/DocumentTypeTabs.tsx`
- `components/invoices/ScreenModeTabs.tsx` (+ test)
- `components/navigation/MobileAppHeader.tsx` (+ test)
- `components/i18n/LanguageSwitcher.tsx` (`min-h-9` → `min-h-11`; it sits on
  the same header row as the bell and must not look shorter than it)
- `app/(app)/invoices/index.tsx` (inline chip map → `<InvoiceFilterChips>`)
- `lib/i18n/locales/hu.ts`, `lib/i18n/locales/en.ts`
- `docs/loop-queue.md` (tick the item at the end of the Build run)

## 6. i18n keys (hu + en, both required)

| Key | hu | en |
|---|---|---|
| `nav.notificationsUnread` | `"Értesítések, {{count}} olvasatlan"` | `"Notifications, {{count}} unread"` |
| `invoices.vat.rateA11y` | `"{{rate}}% áfakulcs"` | `"{{rate}}% VAT rate"` |
| `invoices.list.filterOtherHint` | `"Nem szűrhető (díjbekérő, részben fizetett, sztornózott)"` | `"Not filterable (proforma, partially paid, cancelled)"` |

`nav.notificationsUnread` goes next to `nav.notifications` (hu.ts:16);
`invoices.vat.rateA11y` next to `invoices.vat.advancedToggle` (hu.ts:397);
`invoices.list.filterOtherHint` next to `invoices.list.filterOther`
(hu.ts:187). The hint is rendered as the accessibility label / muted tooltip
of the non-interactive "Egyéb" element so the EV understands why it does not
act like the other chips.

No hardcoded user-facing string may be introduced (AGENTS.md §9,
`.claude/skills/i18n-sync`).

## 7. db/schema.ts changes

**None.** This slice touches no database code, no migration, no
`drizzle-kit generate`. Explicitly: neither ADDITIVE nor DESTRUCTIVE — zero
schema surface.

## 8. UX notes

**Mobile (375px)**

- A wrapped pill row grows taller: `VatCategoryPicker`'s advanced list is
  already vertical, but the 4 VAT-rate pills at 44px still fit one row at
  375px (4 × ~52px + gaps ≈ 236px). Verify by eye at 375px; if a row wraps,
  that is acceptable — do **not** shrink below 44px to avoid a wrap.
- Use `ChoicePillGroup` (`space="sm"`, `flex-wrap`) so wrapped rows keep an
  even 8px vertical gap instead of the current `space="xs"` crowding, which
  looks broken once the rows are 44px tall.
- The composer already has a sticky total bar; taller pickers push content
  down, so confirm Step "Partner" still reaches the Következő button without
  the dates/payment accordion clipping.
- Bell: the 44px box must not push the header taller — the header row is
  `px-4 py-3` around a 36px avatar, so a 44px bell makes the row ~44px tall.
  That is fine and intentional; check the avatar/title block stays vertically
  centred and the language switcher (also 44px now) aligns with it.

**Desktop (≥768px)**

- 44px is the same on desktop; do not add a `md:` shrink. Pills stay
  `px-3`, so the filter row and the payment-method row remain single-line at
  1440px — confirm the invoice-list header does not wrap to a second row.
- The `md:flex-1 md:px-4 md:py-3` on `DocumentTypeTabs` already exceeds 44px;
  adding `min-h-11` must not fight it (floor, not fixed height).
- Hover/focus: `ChoicePill` inherits the focus ring from
  `components/ui/pressable` (`data-[focus-visible=true]:ring-2`) — keyboard
  tabbing through the VAT pills must show it; do not add `outline-none`.

## 9. Risk classification

**none.**

- No `lib/tax/`, no tax figure, no rate table is read or written — the VAT
  *values* (`VAT_RATES`, `VAT_CATEGORIES` in `lib/invoices/vat.ts`) are
  untouched; only how their buttons are sized changes.
- No `lib/nav/`, `lib/m2m/`, no NAV environment/default, no credential.
- No marketing copy; `marketing/` is not touched.
- No schema, no migration, no API route, no serialized payload.
- The only behavioural change beyond sizing is removing a dead `Pressable`
  that never had an `onPress` (AC8) — it cannot regress a working flow.

Therefore this item is **not** gated and may auto-ship if typecheck + unit
tests are green and no confirmed high/medium finding remains.

## 10. Out of scope

- **Deleting `components/invoices/LineItemEditor.tsx`** (+ its test) even
  though it is dead code — that is a separate cleanup item, filed as a
  follow-up note under this item in `docs/loop-queue.md`. This slice must not
  "fix" its pills; they render nowhere.
- Making "Egyéb" an actual working filter (would need a new filter value,
  `useInvoiceStatusCounts` support and an API query) — this slice only stops
  it pretending to be a button.
- Tap targets outside the invoice flow: clients, products, receipts,
  settings, the sidebar/`MobileTabBar`, `OverflowMenu`. File them separately
  if an audit still flags them.
- Display-only chips (`InvoiceStatusChip`, `Badge`) — explicitly must stay
  small (AC12).
- A Playwright/e2e tap-target sweep. Unit-level className assertions are the
  contract here; the authenticated e2e run is still blocked on the Phase 0
  "Auth E2E test user/fixture" item.
- Any redesign of the pickers (e.g. replacing VAT pills with a select/sheet).
  Sizing and consolidation only.
