# InvoHub

> The bridge between you and Hungarian invoicing.
> NAV-compatible billing for English-speaking entrepreneurs working in Hungary.

Cross-platform app (iOS · Android · Web) from a single codebase.

## Stack

| Layer        | Choice                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Framework    | [Expo](https://expo.dev) + [Expo Router](https://docs.expo.dev/router) (SDK 56) |
| Language     | TypeScript                                                             |
| UI / Design  | [gluestack-ui](https://gluestack.io/ui) v5                             |
| Styling      | [NativeWind](https://nativewind.dev) (Tailwind CSS)                    |
| Auth         | [Better Auth](https://better-auth.com) (email + password, Expo plugin) |
| Local data   | [AsyncStorage](https://react-native-async-storage.github.io/async-storage/) (invoices on device) |
| ORM          | [Drizzle](https://orm.drizzle.team)                                   |
| Database     | [Neon](https://neon.tech) (serverless Postgres — auth only)           |

UI components live in `components/ui/` (Gluestack CLI). Invoices are stored locally on the device; auth uses Neon via Better Auth.

## Project structure

```
app/
  _layout.tsx              Root layout (GluestackUIProvider + stack)
  index.tsx                Landing page
  login.tsx                Sign in / sign up
  (app)/
    _layout.tsx            Auth gate + responsive AppShell
    invoices/
      index.tsx            Invoice list
      new.tsx              Create invoice
  api/auth/[...auth]+api.ts Better Auth server handler
components/
  ui/                      Gluestack UI primitives
  navigation/AppShell.tsx  Mobile tabs + desktop sidebar
  invoices/                Invoice-specific components
hooks/useInvoices.ts       AsyncStorage invoice hook
lib/invoices/              Types, calculations, storage
db/                        Drizzle schema + Neon client (auth)
lib/
  auth.ts                  Better Auth server instance
  auth-client.ts           Better Auth client (web + native)
```

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment** — copy the example and fill in your Neon details:

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL` — your Neon **pooled** connection string.
   - `BETTER_AUTH_SECRET` — generate with `openssl rand -base64 32`.
   - `EXPO_PUBLIC_AUTH_BASE_URL` — auth backend origin (`http://localhost:8081` in dev).

3. **Create the database tables** (Better Auth schema via Drizzle):

   ```bash
   npm run db:push
   ```

4. **Run the app**

   ```bash
   npm run web       # browser
   npm run ios       # iOS simulator
   npm run android   # Android emulator
   ```

## Auth notes

- Email/password is enabled out of the box. Sign up at `/login`, then you land on `/invoices`.
- On native, sessions are stored securely via `expo-secure-store`; on web via cookies.
- Invoices are stored in AsyncStorage on the device (not synced to the server yet).

## Adding Gluestack components

```bash
npx gluestack-ui@latest add dialog select table avatar
```

## Scripts

| Command               | Description                          |
| --------------------- | ------------------------------------ |
| `npm run web/ios/android` | Start the app on a platform      |
| `npm run typecheck`   | TypeScript check                     |
| `npm run db:generate` | Generate Drizzle migrations          |
| `npm run db:push`     | Push schema to Neon                  |
| `npm run auth:generate` | Regenerate Better Auth schema      |
