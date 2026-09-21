# Plan — NotificationPanel chrome: Hungarian i18n, real close button, tap-target floor

Slug: `notification-panel-i18n-chrome-text`
Branch (created later by Build, in its own worktree):
`slice/notification-panel-i18n-chrome-text`
Phase: 1 — Core invoicing, NAV-compliant
Date: 2026-09-21
Risk: **none** (presentational strings + one pure formatter; no `lib/tax/`,
no NAV/M2M behaviour, no tax figure, no marketing claim, no schema change)

Source: `docs/loop-queue.md` Phase 1 i18n item —
`components/notifications/NotificationPanel.tsx` hardcoded English chrome
(2026-09-15 audit, `docs/audits/ux-overhaul-2026-09-14/REPORT.md:120`).

---

## 0. What is actually wrong (measured against the code on `main`)

`components/notifications/NotificationPanel.tsx` never imports
`useTranslation`. Every string it renders is an English literal:

| Line | Literal | Should be |
|---|---|---|
| 74 | `"Notifications"` | `t("notifications.panel.title")` |
| 91 | `"Mark all read"` | `t("notifications.panel.markAllRead")` |
| 96 | `"Refresh"` | `t("notifications.panel.refresh")` |
| 109 | `"No notifications yet. They appear for overdue invoices, NAV sync, and reminders."` | empty-state title + description keys |
| 41 | `"Just now"` | `t("notifications.when.justNow")` |
| 42 | `` `${diffHours}h ago` `` | `t("notifications.when.hoursAgo", { count })` |

Three further defects sit in the same 150-line file and are cheaper to fix
now than to re-file:

1. **`formatWhen` (lines 36–44) is wrong, not just untranslated.**
   - It bins everything under 60 minutes as "Just now", so a notification
     from 55 minutes ago and one from 5 seconds ago read identically.
   - A timestamp in the future (server/device clock skew, and every
     `nav_pending` row written by a server whose clock runs ahead) gives a
     negative `diffHours` → `"-1h ago"`. Renders as literal garbage.
   - The fallback `date.toLocaleDateString()` passes **no locale**, so it
     formats in the *device* locale, ignoring the app's HU/EN switch. Every
     other date in the app goes through `lib/dates/format.ts`
     (`DOCUMENT_LOCALE = "hu-HU"`, `"2026. 07. 05."`).
2. **The close control is invisible.** Line 81 renders `<DrawerCloseButton />`
   with **no children** — `components/ui/drawer/index.tsx:166` styles it as a
   bare `p-2` Pressable, so it paints nothing, has no accessibility label, and
   is an ~16px touch target. On a 375px phone the drawer covers the whole
   screen and the only way out is the backdrop, which is not visible either.
3. **The action buttons are below the 44px floor** this repo adopted in
   `slice/invoice-flow-tap-targets-44px` (`lib/ui/tap-target.ts`). Both use
   `size="sm"` → `min-h-8` = 32px (`components/ui/button/index.tsx:53`).

### Discrepancy the implementer must know about

The queue item says the 2026-09-15 fix "covered generated notification
*content*". **That fix is not on `main`.** Verified:
`git show main:lib/notifications/service.ts` still writes literal English
titles — `Overdue: ${inv.invoiceNumber}`, `Awaiting payment: …`,
`NAV submission pending`, `Welcome to InvoHub` (lines 146–201), and
`lib/i18n/locales/hu.ts` has no notification-content keys (only
`notifications.banner.*`). The content fix exists only on the unmerged
branch of commit `7efccac`.

Consequence: after this slice the panel's **chrome** is Hungarian while row
**titles/bodies** are still English. That is the correct outcome for this
slice — content localisation is a separate, larger change (it needs stored
i18n keys + params, i.e. a schema change, plus the backfill item already in
the queue). Do **not** widen scope to it here. Do **not** delete or edit the
neighbouring queue item; just leave it unchecked.

## 1. Goal and user value

An egyéni vállalkozó running InvoHub in Hungarian opens the bell and today
gets an English panel with no visible way to close it. After this slice the
panel's own chrome is fully Hungarian (and fully English when the user
switches to EN), the timestamps are honest ("Az imént" / "12 perce" /
"5 órája" / "Tegnap" / "2026. 07. 05."), the drawer has a visible, labelled,
44×44 close button, and both actions clear the tap-target floor on a phone.

## 2. Acceptance criteria (numbered, testable)

1. `NotificationPanel` renders no hardcoded user-facing English. Rendering it
   with the HU locale produces a tree whose serialised JSON contains none of
   `"Notifications"`, `"Mark all read"`, `"Refresh"`, `"No notifications yet"`,
   `"Just now"`, `" ago"`, `"Close"`.
2. Panel header shows `hu.notifications.panel.title` ("Értesítések") and, when
   `unreadCount > 0`, the count badge; the badge carries an
   `accessibilityLabel` of `notifications.panel.unreadCount` with the count.
3. The "mark all read" button renders `hu.notifications.panel.markAllRead`,
   is present only when `unreadCount > 0`, carries
   `accessibilityLabel = t("notifications.panel.markAllReadA11y")`, and calls
   `onMarkAllRead` exactly once when pressed.
4. The refresh button renders `hu.notifications.panel.refresh` and calls
   `onSync` exactly once when pressed.
5. Both action buttons include `TAP_TARGET_MIN_H` from `@/lib/ui/tap-target`
   in their `className` (no `min-h-8`-only `size="sm"` target remains), and
   each notification row `Pressable` is at least `min-h-11`.
6. The drawer close control renders a visible lucide `X` icon, has
   `accessibilityRole="button"`, `accessibilityLabel =
   t("notifications.panel.close")`, uses `TAP_TARGET_ICON_BOX`, and calls
   `onClose` when pressed.
7. Empty state (not loading, zero notifications) renders
   `hu.notifications.panel.empty.title` and
   `hu.notifications.panel.empty.description`; the description names the three
   sources the panel actually produces (lejárt számlák, NAV-beküldés,
   emlékeztetők) and claims nothing else.
8. The loading state's `ActivityIndicator` has
   `accessibilityLabel = t("notifications.panel.loading")`.
9. New pure module `lib/notifications/relative-time.ts` exports
   `describeRelativeWhen(iso: string, now: Date): RelativeWhen` returning a
   **descriptor**, never a rendered string:
   `{ kind: "justNow" } | { kind: "minutes"; count } | { kind: "hours"; count }
   | { kind: "yesterday" } | { kind: "absolute"; date: string }`.
   Boundaries, asserted by unit test: `< 60s` → `justNow`; `< 60min` →
   `minutes` (floored, ≥1); `< 24h` → `hours` (floored, ≥1); `< 48h` →
   `yesterday`; otherwise `absolute` with `formatDateOnly(iso)` from
   `@/lib/dates/format` (so `"2026. 07. 05."`, same as the invoice UI).
10. `describeRelativeWhen` never returns a negative count: a timestamp up to
    24h **in the future** returns `justNow`; further in the future returns
    `absolute`. An unparseable string returns `{ kind: "absolute", date: iso }`
    and does not throw.
11. `NotificationPanel` renders each row's timestamp by mapping that
    descriptor through `t("notifications.when.*")` — `absolute` renders the
    formatted date with no key lookup.
12. `lib/i18n/locales/hu.ts` and `en.ts` both define every new key; the
    existing parity test in `lib/i18n/locales/en.test.ts` stays green and gains
    an explicit assertion for `notifications.panel.*` + `notifications.when.*`.
13. The redundant inner `<ScrollView>` (line 113) is removed — `DrawerBody` is
    already a `ScrollView` (`components/ui/drawer/index.tsx:36`), and nesting
    two breaks momentum scrolling on native. A render test asserts the list is
    not wrapped in a second `ScrollView`.
14. `npx tsc --noEmit` and `npm run test:unit` are green.

## 3. Tests to write first (TDD)

Write these **before** touching `NotificationPanel.tsx`; each must fail first.

**A. `lib/notifications/relative-time.test.ts`** (new — pure, fastest signal)
with a fixed `now = new Date("2026-07-05T12:00:00.000Z")`:
- 20 seconds ago → `{ kind: "justNow" }` (AC9)
- 12 minutes ago → `{ kind: "minutes", count: 12 }`
- 59 minutes 59 seconds ago → `{ kind: "minutes", count: 59 }` (boundary)
- 60 minutes ago → `{ kind: "hours", count: 1 }` (boundary)
- 5 hours ago → `{ kind: "hours", count: 5 }`
- 30 hours ago → `{ kind: "yesterday" }`
- 6 days ago → `{ kind: "absolute", date: "2026. 06. 29." }`
- 10 minutes **in the future** → `{ kind: "justNow" }`, and assert no result
  of any case has a negative `count` (AC10)
- `"not-a-date"` → `{ kind: "absolute", date: "not-a-date" }`, no throw (AC10)

**B. `components/notifications/NotificationPanel.test.tsx`** (new).
Copy the harness from `components/notifications/NotificationBanner.test.tsx`:
the **real hu-locale lookup** `react-i18next` mock (so the assertions prove
Hungarian, not "whatever key was passed"), the `@/lib/theme/icon-colors` mock,
and `jest.mock("@/components/ui/box" | "text" | "pressable" | "hstack" |
"vstack" | "badge" | "button", …)` → `@/__tests__/mocks/gluestack-ui`.
Add a drawer mock in the shape used by
`components/invoices/composer/ComposerSummary.test.tsx:20` plus
`DrawerCloseButton` (the panel's own close control replaces it — see §4), and
`jest.mock("expo-router", () => ({ router: { push: jest.fn() } }))`.
Cases: AC1 (the no-English-literals sweep), AC2, AC3, AC4, AC5, AC6, AC7, AC8,
AC11 (a row with `createdAt` 5h before a frozen `Date.now()` shows
`hu.notifications.when.hoursAgo` interpolated with `5`, and one 20s old shows
`"Az imént"`), AC13.

**C. `lib/i18n/locales/en.test.ts`** — extend with AC12's explicit assertion
loop over `[en, hu]`.

## 4. Files to touch

| File | Change |
|---|---|
| `lib/notifications/relative-time.ts` | **new** — `RelativeWhen` type + `describeRelativeWhen`, reusing `formatDateOnly` from `@/lib/dates/format` |
| `lib/notifications/relative-time.test.ts` | **new** — §3A |
| `components/notifications/NotificationPanel.tsx` | `useTranslation`; delete local `formatWhen`; all chrome via `t()`; replace `<DrawerCloseButton />` with a labelled `Pressable` + lucide `X` using `TAP_TARGET_ICON_BOX` and `onPress={onClose}`; `TAP_TARGET_MIN_H` on both action buttons and `min-h-11` on row pressables; drop the inner `ScrollView` |
| `components/notifications/NotificationPanel.test.tsx` | **new** — §3B |
| `lib/i18n/locales/hu.ts` / `en.ts` | new keys under the existing `notifications` object |
| `lib/i18n/locales/en.test.ts` | §3C |
| `docs/loop-queue.md` | tick the item with a one-paragraph note, as the queue's other done items do |

No other component imports `NotificationPanel` except
`components/navigation/AppShell.tsx:22`, which already mocks it out in
`AppShell.test.tsx:63` — no prop signature changes, so nothing else moves.

## 5. i18n keys (hu + en)

Add inside the existing `notifications: { banner: … }` object in both locales,
keeping key order identical between files (the parity test compares sets, but
reviewers diff side by side):

```ts
// hu.ts
notifications: {
  banner: { /* unchanged */ },
  panel: {
    title: "Értesítések",
    unreadCount: "{{count}} olvasatlan",
    markAllRead: "Mind olvasott",
    markAllReadA11y: "Összes értesítés megjelölése olvasottként",
    refresh: "Frissítés",
    close: "Értesítések bezárása",
    loading: "Értesítések betöltése",
    empty: {
      title: "Nincs még értesítés",
      description:
        "Itt jelennek meg a lejárt számlák, a NAV-beküldések állapota és a fizetési emlékeztetők.",
    },
  },
  when: {
    justNow: "Az imént",
    minutesAgo: "{{count}} perce",
    hoursAgo: "{{count}} órája",
    yesterday: "Tegnap",
  },
},
```

```ts
// en.ts
notifications: {
  banner: { /* unchanged */ },
  panel: {
    title: "Notifications",
    unreadCount: "{{count}} unread",
    markAllRead: "Mark all read",
    markAllReadA11y: "Mark all notifications as read",
    refresh: "Refresh",
    close: "Close notifications",
    loading: "Loading notifications",
    empty: {
      title: "No notifications yet",
      description:
        "Overdue invoices, NAV submission status, and payment reminders show up here.",
    },
  },
  when: {
    justNow: "Just now",
    minutesAgo: "{{count}} min ago",
    hoursAgo: "{{count}}h ago",
    yesterday: "Yesterday",
  },
},
```

Notes:
- Hungarian has no plural agreement after a numeral, so `{{count}} perce` /
  `{{count}} órája` are correct for every count — **do not** add `_one`/
  `_other` variants. The existing `notifications.banner.more` already proves
  this project's i18next setup resolves a bare key when `count` is passed.
- "Mind olvasott" is deliberately short: at 375px it sits beside "Frissítés"
  in one row. The long form lives in the accessibility label.

## 6. db/schema.ts changes

**None.** No migration, no `drizzle-kit generate`, no `db:push`. (Explicitly:
neither ADDITIVE nor DESTRUCTIVE — the slice does not touch `db/`.)

## 7. UX notes

**Mobile, 375px.** `DrawerContent` is `w-full max-w-sm` (384px), so the panel
is full-bleed on a phone. Budget the header row at 375 − 32 (px-4) = 343px:
Bell 20px + gap + "Értesítések" (~96px at `text-lg`) + badge (~28px) leaves
~170px, comfortably enough for the new 44×44 close box on the right. Keep the
close button as the last child of the header `HStack` with
`justify-between`. The action row must stay a single line: "Mind olvasott"
(~118px with the `CheckCheck` icon) + `space="sm"` 8px + "Frissítés" (~86px) =
~212px of 343px. Both buttons keep `size="sm"` typography but gain
`TAP_TARGET_MIN_H`, so they grow vertically to 44px, not horizontally. Rows
already run `px-4 py-3`; add `min-h-11` so a single-line title row still
clears the floor. Verify the list scrolls after the inner `ScrollView` is
removed — if `DrawerBody`'s `shrink-0` base class fights `flex-1`, keep
`className="flex-1"` on `DrawerBody` and let it scroll.

**Desktop, ≥1024px.** Same component, right-anchored at 384px beside the
`AppTopStrip` bell. Nothing about the layout changes; the close X gives mouse
users the affordance they expect in the drawer's top-right corner, which the
backdrop click alone did not signal. Check the empty state still centres at
384px — the Hungarian description is ~30% longer than the English original and
wraps to three lines at that width, which is fine inside `px-6 py-12`.

**Both.** Relative timestamps must not jump when the panel is reopened; the
formatter takes `now` as an argument, so the component computes it once per
render (`const now = new Date()` at the top of the component body) rather than
per row.

## 8. Risk classification

**none.** The slice changes presentational strings, one pure date-descriptor
function, and touch geometry. It does not touch `lib/tax/`, `lib/nav/`
production behaviour, `lib/m2m/`, `marketing/`, `db/schema.ts`, or any NAV
environment default, and it states no compliance or tax claim. Eligible for
the dev-loop's normal Ship path once typecheck + unit tests are green.

## 9. Out of scope

- **Localising generated notification content** (`lib/notifications/service.ts`
  titles/bodies). Still English on `main` (see §0) and needs stored i18n keys +
  params — a schema change and its own plan. Leave the two related queue items
  untouched.
- The data backfill for pre-2026-09-15 notification rows (already its own
  queue item).
- `NotificationBanner` (already i18n'd), `MobileAppHeader`/`AppTopStrip` bell
  geometry (covered by `slice/fix-notification-bell-language-switcher-hitslop-overlap`).
- Notification preferences, push/email delivery, per-type filtering, grouping,
  pagination, an "unread only" toggle.
- Making `notifications.banner.*` and the new `notifications.panel.*` share
  wording — the banner is a separate surface and its copy is already shipped.
- Playwright E2E for the panel; unit coverage is the gate for this slice.
