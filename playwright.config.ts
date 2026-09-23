// playwright.config.ts
// Playwright E2E config for InvoHub web (Expo web dev server) and the static marketing site.
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_WEB_PORT ?? 8081);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

const MARKETING_PORT = Number(process.env.E2E_MARKETING_PORT ?? 4321);
const marketingBaseURL =
  process.env.E2E_MARKETING_BASE_URL ?? `http://localhost:${MARKETING_PORT}`;

const MARKETING_TESTS = /marketing\.spec\.ts/;
const PRODUCTION_TESTS = /production-smoke\.spec\.ts/;

// Production smoke tests assert the deployed site, so they only exist as projects
// when a production base URL is provided. Otherwise a pull request would have to
// fail until its own deploy is live.
const productionProjects = process.env.PRODUCTION_BASE_URL
  ? [
      {
        name: "production-desktop",
        use: { ...devices["Desktop Chrome"] },
        testMatch: PRODUCTION_TESTS,
      },
      {
        name: "production-mobile",
        use: { ...devices["Pixel 7"] },
        testMatch: PRODUCTION_TESTS,
      },
    ]
  : [];

export default defineConfig({
  testDir: "./e2e/web",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    // Says out loud when the authenticated specs sat out for want of
    // credentials — a green suite that skipped every signed-in flow looks
    // exactly like one that covered them (e2e/reporters/auth-coverage.ts).
    ["./e2e/reporters/auth-coverage.ts"],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [MARKETING_TESTS, PRODUCTION_TESTS],
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      testIgnore: [MARKETING_TESTS, PRODUCTION_TESTS],
    },
    {
      name: "marketing-desktop",
      use: { ...devices["Desktop Chrome"], baseURL: marketingBaseURL },
      testMatch: MARKETING_TESTS,
    },
    {
      name: "marketing-mobile",
      use: { ...devices["Pixel 7"], baseURL: marketingBaseURL },
      testMatch: MARKETING_TESTS,
    },
    ...productionProjects,
  ],
  webServer: process.env.E2E_SKIP_SERVER
    ? undefined
    : [
        {
          command: `npx expo start --web --port ${PORT}`,
          url: baseURL,
          reuseExistingServer: process.env.E2E_FORCE_NEW_SERVER !== "true",
          timeout: process.env.CI ? 180_000 : 120_000,
        },
        {
          command: `node scripts/serve-marketing.mjs`,
          env: { MARKETING_PORT: String(MARKETING_PORT) },
          url: marketingBaseURL,
          reuseExistingServer: process.env.E2E_FORCE_NEW_SERVER !== "true",
          timeout: 30_000,
        },
      ],
});
