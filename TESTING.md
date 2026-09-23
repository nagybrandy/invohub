# Testing

InvoHub uses a three-layer test stack that runs in CI on every push/PR and before Vercel web builds.

## Layers

| Layer | Tool | Scope |
|-------|------|--------|
| Unit / integration | Jest + jest-expo | `lib/`, `hooks/`, components, API helpers |
| Web E2E | Playwright | Public routes, auth gates, navigation |
| Mobile E2E | Maestro | iOS + Android smoke flows |

## Commands

```bash
# Unit tests (all platforms' shared logic)
npm run test:unit

# Watch mode during development
npm run test:unit:watch

# Coverage report → coverage/
npm run test:unit:coverage

# Web E2E (starts Expo web on :8081, or reuse running server)
npm run test:e2e:web

# Use an already-running Expo web dev server on :8081
E2E_SKIP_SERVER=1 npm run test:e2e:web

# Authenticated web E2E specs (dashboard/invoices/receipts/settings "(authenticated)"
# describe blocks) — set up a test account once against a scratch/dev database, then
# export the same credentials when running Playwright:
DATABASE_URL=<scratch db> E2E_TEST_EMAIL=e2e-test@invohub.test E2E_TEST_PASSWORD='...' \
  npm run create-test-user

E2E_TEST_EMAIL=e2e-test@invohub.test E2E_TEST_PASSWORD='...' \
  npm run test:e2e:web
```

Without `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` set, those authenticated specs report a
clear skip reason instead of running against an unauthenticated page (see
`e2e/web/fixtures/auth.ts`).

## Turning the authenticated specs on in CI

**61 of the web E2E specs are behind that guard** — every signed-in flow, i.e. invoices,
dashboard, settings, receipts and navigation. Until the secrets below exist, the "Web E2E
(Playwright)" check is green on the unauthenticated specs alone. Every run says so:
`e2e/reporters/auth-coverage.ts` prints the count and writes it to the GitHub job summary,
so the gap is visible rather than implied by a passing badge.

The workflow already passes the credentials through (`.github/workflows/test.yml`), so
adding the repository secrets is the only step — no code change follows:

| Secret | What it is |
|---|---|
| `E2E_TEST_EMAIL` | the test account's address, e.g. `e2e-test@invohub.test` |
| `E2E_TEST_PASSWORD` | its password |
| `E2E_DATABASE_URL` | a **scratch/dev** Neon database — never production |
| `E2E_BETTER_AUTH_SECRET` | any random string; Better Auth needs one to sign sessions |

Then seed the account once against that scratch database:

```bash
DATABASE_URL=<scratch db> E2E_TEST_EMAIL=e2e-test@invohub.test E2E_TEST_PASSWORD='...' \
  npm run create-test-user
```

Point `E2E_DATABASE_URL` at production and a CI run would write invoices into real data,
so treat that as the one hard rule here.

```bash

# Web E2E interactive UI
npm run test:e2e:web:ui

# Mobile E2E (requires Maestro CLI + simulator/emulator + dev build)
npm run test:e2e:ios
npm run test:e2e:android
npm run test:e2e:mobile

# Typecheck + unit + web E2E (CI / pre-deploy)
npm run test:ci

# Everything except mobile (typecheck + unit + web)
npm run test:all

# Mobile E2E included (set RUN_MOBILE_E2E=true)
RUN_MOBILE_E2E=true npm run test:all
```

## Mobile E2E setup

1. Install [Maestro](https://maestro.mobile.dev): `curl -Ls "https://get.maestro.mobile.dev" | bash`
2. Build and install the dev app: `npm run ios` or `npm run android`
3. Run flows: `npm run test:e2e:ios`

Set `APP_ID=hu.invohub.app` (iOS bundle id from `app.json`) if needed.

## CI

GitHub Actions workflow `.github/workflows/test.yml`:

- **unit** — typecheck + Jest on every PR
- **web-e2e** — Playwright on every PR
- **ios-e2e / android-e2e** — Maestro smoke on `main` (continues on error if no simulator)

## Adding tests

**Required:** every new feature or material behavior change must add or update tests in the same PR/commit. Agents: see `.cursor/rules/testing-new-features.mdc` and `AGENTS.md` § Testing.

| Source | Test file | Notes |
|--------|-----------|--------|
| `lib/foo.ts` | `lib/foo.test.ts` | Mock `@/db` for Drizzle; pure helpers need no mock |
| `hooks/useFoo.ts` | `hooks/useFoo.test.tsx` | Mock `apiFetch`; use `react-test-renderer` + `act` |
| `components/Bar.tsx` | `components/Bar.test.tsx` | Mock Gluestack UI; assert render + interactions |
| Routes / nav | `lib/navigation.test.ts`, `lib/app-navigation.test.ts` | New `routes.*` helpers and nav rules |

- Place unit tests next to source: `lib/foo.ts` → `lib/foo.test.ts`
- Shared fixtures: `__tests__/fixtures/`
- Gluestack UI mocks: `__tests__/mocks/gluestack-ui.tsx`
- Web E2E specs: `e2e/web/*.spec.ts`
- Maestro flows: `e2e/maestro/flows/*.yaml`

Before finishing: `npm run test:unit` (all green).
