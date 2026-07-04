# InvoHub — Agent Guide

Cross-platform invoicing app: **Expo SDK 56**, **Expo Router**, **Gluestack UI v5**, **NativeWind v4**, **Better Auth**, **Neon + Drizzle**.

## Stack

| Layer | Tech |
|-------|------|
| UI | Gluestack UI v5 (`components/ui/`), NativeWind `className` |
| Routing | Expo Router — `app/` file-based routes |
| Auth | Better Auth + `@better-auth/expo` |
| Data | Drizzle ORM + Neon Postgres, API routes in `app/api/` |
| i18n | `react-i18next` — keys in `lib/i18n/locales/` |

## Project layout

```
app/(app)/          Protected screens (AppShell)
app/api/            Serverless API routes (*+api.ts)
components/ui/      Gluestack primitives (+ *.web.tsx for web DOM)
components/layout/  ScreenLayout, ListScreen, FormScreen
lib/                Domain logic, email, NAV, payments
hooks/              API-backed React hooks
```

## Gluestack + React Native + Web rules

### 1. Styling: prefer `className`, not `style`

On **web**, never pass React Native **style arrays** to DOM nodes. That causes:

`Failed to set an indexed property [0] on 'CSSStyleDeclaration'`

```tsx
// BAD on web
<View style={[styles.a, styles.b]} />
<Pressable style={[{ padding: 8 }, props.style]} />

// GOOD
<Box className="p-2 bg-background" />
```

If `style` is unavoidable, flatten first: `StyleSheet.flatten([a, b])`.

### 2. Web DOM wrappers (`*.web.tsx`)

Gluestack web components render native HTML (`div`, `span`, `h1`). They **must** use `webDomProps()` before spreading rest props:

```tsx
import { webDomProps } from "@/components/ui/web-dom-props";

<div className={boxStyle({ class: className })} {...webDomProps(props)} />
```

Never `{...props}` directly on DOM elements — FlatList, RefreshControl, and RN parents inject `style` arrays.

**Helper:** `components/ui/web-dom-props.ts`

### 3. FlatList on web

Avoid `ListEmptyComponent={<Center>…</Center>}` — RN injects `style` into the root child.

```tsx
// BAD — crashes on web
<FlatList ListEmptyComponent={<Center>…</Center>} />

// GOOD — early return outside FlatList
if (!loading && data.length === 0) {
  return <EmptyState />;
}
return <FlatList data={data} … />;
```

Or use `ListEmptyComponent={() => …}` **and** ensure the root uses `webDomProps` (still prefer early return).

Use `contentContainerClassName` (NativeWind), not `contentContainerStyle` arrays.

### 4. Platform-specific files

| Pattern | Use |
|---------|-----|
| `Component.tsx` | Default — React Native `View`, `Text`, `Pressable` |
| `Component.web.tsx` | Web — HTML + `webDomProps` |
| `Platform.OS === 'web'` | Only when file split is impractical |

Import paths stay the same (`@/components/ui/box`); Metro resolves `.web.tsx` on web.

### 5. Gluestack component conventions

- Use **`tva()`** + `className` via `componentStyle({ class: className })`
- Layout: `Box`, `VStack`, `HStack`, `Center` — not raw `View` in screens
- Forms: `FormControl`, `Input`, `Button`, `Textarea` from `components/ui/`
- Theme: `GluestackUIProvider` in `app/_layout.tsx`, tokens in `components/ui/gluestack-ui-provider/config.ts`
- Generated UI files may have `// @ts-nocheck` — do not remove without fixing types

### 6. Icons

- **Lucide** (`lucide-react-native`) in app screens — works on web via RN SVG
- **Gluestack Icon** (`components/ui/icon`) for internal UI primitives

### 7. Navigation

- Route helpers: `lib/navigation.ts` (`routes.invoices`, `routes.invoiceDetail(id)`, …)
- App nav structure: `lib/app-navigation.ts` (mobile tabs, dashboard features, desktop sidebar)
- Auth gate: `app/(app)/_layout.tsx` → `AppShell`
- Mobile: bottom tabs (Dashboard, Invoices, New invoice, Settings) + header with user name & notifications
- Desktop (≥768px): sidebar + notification panel

### 8. Data fetching

- Client: `apiFetch()` from `lib/api/client.ts` with `credentials: "include"`
- Server: `requireSession()` from `lib/api/session.ts` in every `app/api/*+api.ts` route
- Hooks wrap API (`useInvoices`, `useClients`, …) — no AsyncStorage for business data

### 9. Testing

See `TESTING.md`. Run `npm run test:unit` before PRs; web E2E via Playwright.

**Every new or changed feature must include tests in the same change** (see `.cursor/rules/testing-new-features.mdc`):

- `lib/` → unit tests (`*.test.ts`)
- `hooks/` → hook tests (`*.test.tsx`, mock `apiFetch`)
- `components/` → render/interaction tests when behavior is non-trivial
- New routes → extend `lib/navigation.test.ts` / `lib/app-navigation.test.ts`

Run `npm run test:unit` before marking work complete.

### 10. Common web crash checklist

When you see `CSSStyleDeclaration` indexed property error:

1. Find the nearest `*.web.tsx` — is `{...props}` missing `webDomProps`?
2. Is a RN `style` array passed to a child of `FlatList`, `Link asChild`, or tabs?
3. Replace `style` with `className` on web code paths
4. For empty lists, render outside `FlatList`

## References

- [Gluestack UI v5 docs](https://gluestack.io/ui/docs)
- [NativeWind v4](https://www.nativewind.dev/)
- [Expo issue #31352](https://github.com/expo/expo/issues/31352) — style arrays on web
- [Expo issue #32879](https://github.com/expo/expo/issues/32879) — tabs/List style arrays

## Do not

- Commit `.env` or SMTP secrets
- Use `style={[…]}` on web-targeted Gluestack/DOM components
- Put business logic in `components/ui/` (layout primitives only)
- Edit auto-generated plan files in `.cursor/plans/`
