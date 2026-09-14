---
name: ux-audit
description: Use when running a UX/visual audit of InvoHub — starting the marketing site or the Expo web app locally, capturing mobile (375px) and desktop (1440px) screenshots with Playwright, and working through the audit checklist (overflow, tap targets, above-fold CTA, contrast, focus, empty/loading/error states, Hungarian text length). Used by the ux-reviewer agent and the continuous-audit workflow.
---

# UX audit

## 1. Start the right server

InvoHub has two separately-servable surfaces:

- **Marketing site** (`marketing/`, plain HTML/CSS/JS): start with
  `MARKETING_PORT=4321 node scripts/serve-marketing.mjs` (defaults to 4321
  if unset). Serves the static site as production does.
- **App** (Expo Router screens under `app/(app)/`): start with
  `npx expo start --web --port 8081`. Requires a signed-in session for
  protected routes — if no test user/session is available, screenshot the
  public routes (login, marketing-adjacent app screens) and note in the
  report which authenticated screens could not be reached.

Wait for the "compiled" / "ready" log line before navigating — don't
screenshot a blank first-paint.

## 2. Viewports

Always capture **both**:
- Mobile: 375×812 (iPhone-class width — InvoHub's tightest breakpoint)
- Desktop: 1440×900 (the sidebar layout breakpoint is ≥768px, but 1440 is
  the realistic desktop width to audit)

## 3. Checklist per screen

- [ ] No horizontal overflow / clipped content at either viewport
- [ ] All interactive elements ≥44×44px on mobile
- [ ] Primary CTA visible above the fold at both viewports
- [ ] Text contrast readable (body vs. background, button label vs. fill)
- [ ] Keyboard focus visible on web (tab through the screen)
- [ ] Loading state renders something (skeleton/spinner), not blank
- [ ] Empty state has a message + a next action, not a blank list
- [ ] Error state is legible and doesn't dead-end the user
- [ ] Hungarian labels/numbers (which run longer than English) don't break
      layout — forint amounts, long company/client names, VAT-status labels

## 4. Screenshot script template

Save as a throwaway script (e.g. `scripts/tmp-audit-screens.mjs`, delete
after the audit) or inline in a one-off Bash heredoc. Uses `@playwright/test`'s
exported `chromium` (already a project dependency — do not add a bare
`playwright` import, it isn't a direct dependency):

```js
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT_DIR = process.argv[2] ?? "docs/audits/_tmp/screens";
mkdirSync(OUT_DIR, { recursive: true });

const routes = [
  "/", // marketing home, or app dashboard route
  // add routes to audit here
];

const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1440, height: 900 },
];

const baseUrl = process.env.AUDIT_BASE_URL ?? "http://localhost:4321";

const browser = await chromium.launch();
for (const viewport of viewports) {
  const page = await browser.newPage({ viewport });
  for (const route of routes) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    const safeName = route.replace(/\//g, "_") || "_root";
    await page.screenshot({
      path: `${OUT_DIR}/${viewport.name}${safeName}.png`,
      fullPage: true,
    });
  }
  await page.close();
}
await browser.close();
```

Run with `node scripts/tmp-audit-screens.mjs docs/audits/<date>/screens`.

## 5. Save output

Screenshots go under `docs/audits/<date>/screens/`. Reference each finding
by its screenshot filename in the report — see the ux-reviewer agent's
output format for how findings are written up.
