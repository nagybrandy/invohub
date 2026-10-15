# Single-file design prototype

One self-contained HTML file with the whole InvoHub web app, for handing to a designer.

```bash
npm run design:prototype      # -> dist-design/invohub-design-prototype.html (gitignored)
```

Double-click the file: no server, no network. Everything is fake — the "backend" is
`runtime/mock-backend.js` (in-memory, saved to localStorage), the users are demo users
(password `demo1234` for all): `anna@` (full account), `peter@` (new account: onboarding and
empty states), `konyvelo@` (accountant), `admin@` (admin panel) — all `@demo.invohub.hu`.

The "Prototípus" button (bottom right) lists the demo users and every screen, and can reset the data.

How it works: `build.mjs` runs `expo export --platform web`, inlines the bundle/CSS/fonts, and
rewrites `window.location`/`window.history` in the bundle to a virtual location/history
(`runtime/shell.js`) because Expo Router cannot `pushState` under `file://`.

Not real in the prototype: PDF output (a one-page placeholder), e-mail sending, NAV, payments.
Rebuild after UI changes; the mock API's tests are in `runtime/mock-backend.test.ts`.
