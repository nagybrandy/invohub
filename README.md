# InvoHub

> The bridge between you and Hungarian invoicing.
> NAV-compatible billing for English-speaking entrepreneurs working in Hungary.

Cross-platform app (iOS · Android · Web) from a single codebase.

## Stack

| Layer        | Choice                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Framework    | [Expo](https://expo.dev) + [Expo Router](https://docs.expo.dev/router) (SDK 56) |
| Language     | TypeScript                                                             |
| UI / Design  | [react-native-reusables](https://reactnativereusables.com) — **shadcn/ui for React Native** |
| Styling      | [NativeWind](https://nativewind.dev) (Tailwind CSS)                    |
| Auth         | [Better Auth](https://better-auth.com) (email + password, Expo plugin) |
| ORM          | [Drizzle](https://orm.drizzle.team)                                   |
| Database     | [Neon](https://neon.tech) (serverless Postgres)                       |

Every UI element is built from the shadcn design system. Web components live in
`components/ui/` and render natively on iOS/Android and as DOM on web through NativeWind.

## Project structure

```
app/
  _layout.tsx              Root layout (theme + Tailwind + portal host)
  index.tsx                Landing page
  login.tsx                Sign in / sign up
  admin/
    _layout.tsx            Auth gate (redirects to /login)
    index.tsx              Protected admin dashboard
  api/auth/[...auth]+api.ts Better Auth server handler (Expo API route)
components/ui/             shadcn / react-native-reusables primitives
db/                        Drizzle schema + Neon client
lib/
  auth.ts                  Better Auth server instance
  auth-client.ts           Better Auth client (web + native)
  utils.ts                 cn() class helper
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

- Email/password is enabled out of the box. Sign up at `/login`, then you land on `/admin`.
- The `user.role` column defaults to `user`. Promote an admin directly in Neon:

  ```sql
  update "user" set role = 'admin' where email = 'you@example.com';
  ```

- On native, sessions are stored securely via `expo-secure-store`; on web via cookies.
- For physical devices / production, set `EXPO_PUBLIC_AUTH_BASE_URL` to your deployed URL
  and add the scheme to `trustedOrigins` in `lib/auth.ts`.

## Scripts

| Command               | Description                          |
| --------------------- | ------------------------------------ |
| `npm run web/ios/android` | Start the app on a platform      |
| `npm run typecheck`   | TypeScript check                     |
| `npm run db:generate` | Generate Drizzle migrations          |
| `npm run db:push`     | Push schema to Neon                  |
| `npm run auth:generate` | Regenerate Better Auth schema      |

## Adding more shadcn components

```bash
npx @react-native-reusables/cli@latest add dialog select table badge avatar
```
