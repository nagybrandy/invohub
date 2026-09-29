# Plan — Exchange-rate warning button tap target, and the 44px floor in `Button` itself

Slug: `exchange-rate-warning-button-tap-target`
Branch (created later by Build, in its own worktree): `slice/exchange-rate-warning-button-tap-target`
Phase: 1 — Core invoicing, NAV-compliant
Date: 2026-09-21
Risk: **none** (presentation only — no `lib/tax/`, no `lib/nav/` or `lib/m2m/`
behaviour, no tax figure, no marketing copy, no schema change)

---

## 0. What is actually broken (verified against current code today)

The queue item (Phase 1, item 10's ship-review follow-up) is literally one
missing class:

- `app/(app)/invoices/[id]/index.tsx:434` — the `isMissingExchangeRate`
  warning card's action:
  ```tsx
  <Button variant="outline" className="self-start border-destructive/40" onPress={…}>
  ```
  No `size`, no `min-h-11`. `buttonStyle`'s `size: default` is
  `'px-4 py-2'` — 8 + ~20 line-height + 8 ≈ **36px**, under the 44px floor
  `lib/ui/tap-target.ts` established in `slice/invoice-flow-tap-targets-44px`.

The queue entry itself notes "other buttons on the same screen are similarly
unstyled". That is the real finding, and it is not one screen's problem:

| Where | Current | Effective height |
|---|---|---|
| `components/ui/button/index.tsx:52` `size: default` | `px-4 py-2` | ≈ **36px** |
| `components/ui/button/index.tsx:53` `size: sm` | `min-h-8 px-3 text-xs` | **32px** |
| `components/ui/button/index.tsx:54` `size: lg` | `min-h-10 px-8` | **40px** |
| `components/ui/button/index.tsx:55` `size: icon` | `min-h-9 min-w-9` | **36px** |

There are **206 `<Button` call sites** across `app/` + `components/`, and
exactly **three** carry a floor class by hand (`components/marketing/
LandingHeader.tsx:160,169,261`) plus one shipped by the last tap-target slice
(`components/invoices/ExchangeRateFixBanner.tsx:53-54`). So every other button
in the signed-in app — "Számla kiállítása", "Storno", "Törlés", "Fizetettnek
jelölés", the mark-paid confirm — is **32–40px**. Decorating one more button by
hand fixes this instance and leaves the next one to another review round.

Three non-`Button` controls on the same screen are worse and are worth taking
while we are in this file:

| Where | Current | Effective height |
|---|---|---|
| `app/(app)/invoices/[id]/index.tsx:523` mark-paid method pills | `px-4 py-2` ad-hoc `Pressable` | ≈ **36px** |
| `app/(app)/invoices/[id]/index.tsx:460-505` linked-document rows (storno/helyesbítő/converted links) | bare `Pressable` around a `size="sm"` `Text` | ≈ **20px** |
| `components/layout/OverflowMenu.tsx:45` / `.web.tsx:92` trigger | `h-8 w-8` + `hitSlop={8}` | **32px** visual (48px touch) |
| `OverflowMenu.tsx:69` / `.web.tsx:129` menu items | `px-3 py-2` + `text-sm` | ≈ **36px** |

The linked-document rows are the worst offender in the app that I can find: a
20px text row is the only way an EV navigates from a helyesbítő back to the
original invoice, and `OverflowMenu`'s 36px rows are where **Storno** and
**Törlés** live — destructive, irreversible NAV-visible actions behind a
sub-44px target.

The mark-paid pills are also a straight duplicate of
`components/ui/choice-pill/index.tsx`, which already exists and already owns
the floor, the selected/unselected tokens and `accessibilityRole="radio"`.

## 1. Goal and user value

An egyéni vállalkozó opens an invoice on a phone to do one of four things:
send it, mark it paid, storno it, or fix what NAV rejected. After this slice
every one of those controls is a ≥44px target (Apple HIG 44pt / WCAG 2.5.8
AAA), and — the point of the slice — **it stays that way for buttons nobody
has written yet**, because the floor moves into the `Button` primitive
instead of being a class each author must remember.

Concretely:

1. The "Árfolyam megadása" button on the NAV-blocking warning card is ≥44px
   (the literal queue item).
2. Every `Button` in the app is ≥44px by construction, at every size.
3. The mark-paid method picker stops being a hand-rolled copy of `ChoicePill`
   and inherits the floor plus the radio semantics.
4. Linked-document navigation (storno ↔ eredeti, helyesbítő ↔ módosított,
   díjbekérő ↔ számla) becomes tappable rather than a 20px text sliver.
5. Storno and Törlés in the overflow menu are ≥44px rows.

## 2. Design

**The floor belongs in `buttonStyle`, not at call sites.** `Button` composes
with `tva()` (twMerge), so `min-h-11` in the size variant is a *default*: a
call site that deliberately passes its own `min-h-*` (e.g.
`LandingHeader.tsx:261`'s `min-h-14`) still wins, which is the behaviour we
want for a floor that some designs exceed. This is the opposite trade-off from
`ChoicePill` (which deliberately avoids `tva` so callers *cannot* shrink it) —
and that is fine here, because a `Button` caller passing `min-h-0` would be an
explicit, greppable, reviewable act, whereas `ChoicePill`'s callers pass
layout classes wholesale. Record the reasoning in a comment above
`buttonStyle` so the next reader does not "unify" the two.

```ts
import { TAP_TARGET_ICON_BOX, TAP_TARGET_MIN_H } from '@/lib/ui/tap-target';

size: {
  default: `${TAP_TARGET_MIN_H} px-4 py-2`,
  sm: `${TAP_TARGET_MIN_H} rounded-lg px-3 text-xs`,
  lg: `${TAP_TARGET_MIN_H} rounded-lg px-8`,
  icon: TAP_TARGET_ICON_BOX,
},
```

`sm` keeps its tighter `px-3` and `text-xs` — it stays a *visually compact*
button, it just stops being a *short* one. That is the correct reading of the
44px rule: density comes from width and type scale, not from a 32px touch
target.

`buttonStyle` must be **exported** so the floor can be asserted directly
(`buttonStyle({ size: 'sm' })`) rather than through a real `Button` render —
`Button`'s root is a `cssInterop`-wrapped RN `Pressable`, and asserting on
`className` after cssInterop under `jest-expo` is exactly the kind of
indirection that makes a guard test flaky. `components/ui/button/index.tsx`
already carries `// @ts-nocheck`; adding `export` to the const is the whole
change.

The warning-card button **also keeps an explicit `TAP_TARGET_MIN_H`** in its
className (as the queue item asks, and matching `ExchangeRateFixBanner`'s
button). It is redundant with the primitive by design: it is the local,
greppable statement that this specific NAV-blocking control is tap-target
critical, and it keeps `ExchangeRateFixBanner.test.tsx`'s existing
`expect(button.props.className).toContain("min-h-11")` assertion meaningful
(that test mocks `@/components/ui/button`, so it can only ever see the
call-site className).

## 3. Acceptance criteria (numbered, testable)

1. `components/ui/button/index.tsx` imports `TAP_TARGET_MIN_H` and
   `TAP_TARGET_ICON_BOX` from `@/lib/ui/tap-target` and uses them in
   `buttonStyle`'s `size` variants — no hardcoded `min-h-8` / `min-h-9` /
   `min-h-10` height class remains in that file.
2. `buttonStyle` is exported, and `buttonStyle({ size })` contains `min-h-11`
   for `default`, `sm` and `lg`, and `h-11 w-11` for `icon`. `buttonStyle()`
   with no args (the `default`/`default` path) also contains `min-h-11`.
3. `sm` still contains `px-3` and `text-xs`, and `lg` still contains `px-8`
   — the floor must not flatten the size scale's horizontal/type differences.
4. The invoice-detail `isMissingExchangeRate` card's action button's
   `className` contains `min-h-11` **and** `self-start` **and**
   `border-destructive/40`, has no `size` prop, and pressing it still calls
   `router.push("/invoices/inv-1/edit?focus=exchangeRate")` (the existing
   detail test's AC5.1/AC5.3 assertions stay green unchanged).
5. The mark-paid method picker renders through `ChoicePill` /
   `ChoicePillGroup`: every method node's `className` contains `min-h-11`,
   pressing one still calls `setPaidMethod(pm.value)` (asserted by pressing
   "cash" then confirming the `POST /api/invoices/inv-1/mark-paid` body
   carries `paymentMethod: "cash"`), and the selected one carries
   `border-primary bg-primary/10` while the others carry
   `border-border bg-background`.
6. Every linked-document row on the detail screen (`invoices.links.stornoOf`,
   `modifiesOf`, `stornoDocument`, `modifiedBy`, `convertedFrom`,
   `convertedTo`) renders a tap row whose `className` contains `min-h-11` and
   which carries `accessibilityRole="link"`; pressing one still calls
   `router.push(routes.invoiceDetail(<that id>))` with the right id.
7. `components/layout/OverflowMenu.tsx` **and** `OverflowMenu.web.tsx`: the
   trigger's `className` contains `h-11 w-11` (via `TAP_TARGET_ICON_BOX`) and
   keeps `hitSlop={8}`; every rendered menu item's `className` contains
   `min-h-11`. Both files' existing tests pass unchanged.
8. **Regression guard:** display-only elements are *not* enlarged —
   `components/invoices/InvoiceStatusChip.tsx` and `components/ui/badge`
   keep their current padding and their existing tests stay green. A 44px
   status chip in a dense list row is a regression, not a fix.
9. No new user-facing string is introduced: no new key in
   `lib/i18n/locales/hu.ts` / `en.ts`, and no hardcoded Hungarian/English
   prose added to any touched file. `lib/i18n/locales/en.test.ts` parity
   stays green.
10. `npx tsc --noEmit` and `npm run test:unit` are green.

## 4. Tests to write first (TDD order)

Write each failing test, then the smallest change that makes it pass.

1. **`components/ui/button/tap-target.test.ts`** (new, ~25 lines) — AC1–AC3.
   Pure unit test on the exported `buttonStyle`, no rendering:
   ```ts
   import { buttonStyle } from "@/components/ui/button";
   import { MIN_TAP_TARGET_PX, TAP_TARGET_MIN_H } from "@/lib/ui/tap-target";

   it.each(["default", "sm", "lg"] as const)("size=%s clears the 44px floor", (size) => {
     expect(buttonStyle({ size })).toContain(TAP_TARGET_MIN_H);
   });
   it("icon size is a 44x44 box", () => {
     expect(buttonStyle({ size: "icon" })).toContain("h-11 w-11");
   });
   it("keeps the size scale's horizontal/type differences", () => {
     expect(buttonStyle({ size: "sm" })).toContain("px-3");
     expect(buttonStyle({ size: "sm" })).toContain("text-xs");
     expect(buttonStyle({ size: "lg" })).toContain("px-8");
   });
   it("defaults to the floor with no args", () => {
     expect(buttonStyle()).toContain(TAP_TARGET_MIN_H);
   });
   it("documents the floor it enforces", () => {
     expect(MIN_TAP_TARGET_PX).toBe(44);
   });
   ```
   If importing `@/components/ui/button` pulls too much Gluestack machinery
   into this test, keep the import and add the same `transformIgnorePatterns`
   already configured — do **not** duplicate the class strings into the test.
2. **`__tests__/screens/invoice-detail.test.tsx`** (extend) — AC4, AC5, AC6.
   The file already mocks `@/components/ui/button` → `mockUi.Pressable` and
   `@/components/ui/pressable` → `mockUi`, and already has
   `findPressableWithText(root, text)`. Add:
   - "the exchange-rate warning card's action clears the 44px floor" — reuse
     the existing EUR-without-rate `mockApiFetch` setup, then
     `expect(String(addRateButton!.props.className)).toContain("min-h-11")`
     and `expect(addRateButton!.props.size).toBeUndefined()`.
   - "every mark-paid method choice is a 44px radio" — open the panel via
     `invoices.markPaid.action`, find the four
     `invoices.paymentMethods.*` nodes, assert each className contains
     `min-h-11` and `accessibilityRole === "radio"`; press
     `invoices.paymentMethods.cash`, press
     `invoice-detail-mark-paid-confirm`, assert the `mark-paid` fetch body
     contains `"paymentMethod":"cash"`.
   - "linked-document rows are 44px links" — extend the existing
     linked-invoice test's `/links` payload (it already returns
     `originalInvoice`), assert the `invoices.links.stornoOf:*` row's
     className contains `min-h-11` and its `accessibilityRole` is `"link"`,
     and that pressing it calls `mockPush` with that invoice's detail route.
     Note the file's existing comment about this being the slow test — reuse
     that describe block rather than adding a second full-links render.
   - Mock `@/components/ui/choice-pill`? **No.** Let the real `ChoicePill`
     render on top of the already-mocked `@/components/ui/pressable`, so the
     className assertions test the real composition.
3. **`components/layout/OverflowMenu.test.tsx`** (extend) and
   **`OverflowMenu.web.test.tsx`** (extend) — AC7. One test each: open the
   menu, assert the trigger className contains `h-11 w-11` and every item
   className contains `min-h-11`. Keep the four/three existing cases
   untouched.
4. AC8 needs no new test — run `components/invoices/InvoiceStatusChip.test.tsx`
   and confirm it is untouched and green.
5. AC9: `npm run test:unit` covers `lib/i18n/locales/en.test.ts` parity.

## 5. Files to touch

New:
- `components/ui/button/tap-target.test.ts`
- `docs/plans/2026-09-21-exchange-rate-warning-button-tap-target.md` (this file)

Changed:
- `components/ui/button/index.tsx` — import the tokens, apply them to the four
  size variants, `export` `buttonStyle`, add the "why tva here but not in
  ChoicePill" comment.
- `app/(app)/invoices/[id]/index.tsx` — `TAP_TARGET_MIN_H` on the
  `isMissingExchangeRate` card action; mark-paid pills →
  `ChoicePillGroup`/`ChoicePill`; linked-document rows → `min-h-11` +
  `accessibilityRole="link"` + `justify-center` so the text stays centred in
  the taller row.
- `components/layout/OverflowMenu.tsx` and `components/layout/OverflowMenu.web.tsx`
  — `TAP_TARGET_ICON_BOX` trigger, `TAP_TARGET_MIN_H` items.
- `__tests__/screens/invoice-detail.test.tsx`,
  `components/layout/OverflowMenu.test.tsx`,
  `components/layout/OverflowMenu.web.test.tsx` — the tests above.
- `docs/loop-queue.md` — tick the item at the end of the Build run.

## 6. i18n keys (hu + en)

**None.** This slice adds no user-facing string. Every label it touches
already goes through `t()` (`invoices.exchangeRateFix.addRate`,
`invoices.paymentMethods.*`, `invoices.links.*`, `invoices.storno`,
`invoices.detail.deleteAction`).

`accessibilityRole="link"` / `"radio"` are ARIA roles, not copy, so they need
no key. If the implementer decides an `accessibilityLabel` is needed anywhere,
it **must** be added to both `lib/i18n/locales/hu.ts` and `en.ts` (AGENTS.md
§9, `.claude/skills/i18n-sync`) — but the visible translated text already
serves as the accessible name, so the expected outcome is zero new keys.

## 7. db/schema.ts changes

**None** — neither ADDITIVE nor DESTRUCTIVE. Zero schema surface: no
`db/schema.ts` edit, no `drizzle-kit generate`, no `db:push`, no migration, no
API route, no serialized payload.

## 8. UX notes

**Mobile (375px)**

- Warning card: `self-start` keeps the button hugging its label; at 44px it no
  longer looks like a caption next to the destructive-red body text. Check the
  card does not push `InvoiceTimeline` below the fold on a 375×812 viewport —
  it grows by ~8px only.
- Mark-paid method pills: four pills (Átutalás / Készpénz / Bankkártya /
  Egyéb) in a `ChoicePillGroup` (`space="sm"`, `flex-wrap`). At 44px with
  `px-3` the Hungarian labels wrap to **two rows** at 375px. That is
  acceptable and expected — do **not** shrink below 44px to keep one row.
  `ChoicePillGroup`'s `space="sm"` gives the wrapped rows an even 8px gap
  (the current `HStack space="sm" flex-wrap` crowds them once they are
  taller).
- Linked-document rows: they currently sit in a `VStack space="xs"` inside a
  `Card`; at 44px each, a storno + helyesbítő + converted trio makes the card
  ~140px tall. Keep `space="xs"` — the 44px rows already read as separated;
  adding vertical space on top would make the card dominate the screen.
- Overflow menu: the trigger grows 32→44px inside
  `InvoiceMoneyHeader`'s `secondaryAction` `HStack space="xs"`, next to the
  mark-paid `size="sm"` button which also becomes 44px. Confirm the two
  together still fit beside the money block at 375px without wrapping the
  header; if they wrap, that is a layout question for a separate item, not a
  reason to keep sub-44px targets.

**Desktop (≥768px)**

- 44px is the same on desktop — no `md:` shrink anywhere.
- `size="sm"` buttons across settings/dashboard rows go 32→44px. Spot-check at
  1440px that no `size="sm"` button sitting inline next to an `Input` or a
  card title now overflows its row — the change is a `min-height`, so rows
  grow rather than clip, but a fixed-height parent would reveal itself here.
- The overflow menu's popover is `min-w-[200px]`; 44px items make a 3-item
  menu ~140px tall. Confirm it still opens downward within the viewport on the
  invoice detail screen and does not clip against the card edge.
- Hover/focus: `buttonStyle`'s base already carries
  `data-[focus-visible=true]:web:ring-2`; the floor must not introduce
  `outline-none` anywhere. Keyboard-tab through the detail screen's actions
  and confirm the ring is still visible on the taller buttons.

## 9. Risk classification

**none.**

- Nothing under `lib/tax/` is read or written; no tax figure, rate or
  threshold appears in the diff.
- Nothing under `lib/nav/` or `lib/m2m/`; no NAV environment, default,
  endpoint or credential is touched. No NAV call is made in any test.
- No `marketing/` copy, no compliance claim, no "replaces the accountant"
  language.
- No `db/schema.ts`, no migration, no API route, no request/response shape.
- Purely presentational: class strings, one `export` keyword, one ad-hoc
  `Pressable` group replaced by the existing `ChoicePill` primitive, and two
  ARIA roles. No control gains, loses or changes an `onPress`.

Therefore this item is **not** tax/legal/NAV-production gated and may
auto-ship if typecheck + unit tests are green and no confirmed high/medium
finding remains.

## 10. Out of scope

- **Tap targets outside the invoice-detail screen's own markup.** The
  `Button` primitive change lifts the whole app's buttons as a side effect —
  that is intended — but this slice does not go screen by screen hunting
  ad-hoc `Pressable`s in clients, products, receipts, settings, the sidebar or
  `MobileTabBar`. File those separately if an audit still flags them.
- **Making `ChoicePill` the one true picker everywhere.** Only the
  invoice-detail mark-paid picker is migrated here, because it is a literal
  duplicate sitting in the file we are already editing.
- **Changing `Button` from `tva()` to a template literal** to make the floor
  un-overridable (the `ChoicePill` approach). Deliberately not done — see §2.
- **`Input` / `Textarea` / `DateField` heights.** Form fields have their own
  sizing question and a separate queue entry already touches composer input
  sizing; mixing them in would make this diff unreviewable.
- **A Playwright/e2e tap-target sweep.** Unit-level className assertions are
  the contract here; the authenticated e2e run is still blocked on the
  Phase 0 "Auth E2E test user/fixture" item.
- **Any redesign** of the warning card, the mark-paid panel, the links card or
  the overflow menu. Sizing, semantics and de-duplication only.
- **The sibling follow-up in the same queue block** — wiring
  `invoices.errors.navMissingExchangeRate` into `NavStatusCard.tsx`. Separate
  item, separate slice.
