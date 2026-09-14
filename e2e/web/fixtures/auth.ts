// e2e/web/fixtures/auth.ts
// Authenticated Playwright fixture: signs in once per worker via the real login page
// and reuses the resulting storage state (cookies) across tests in that worker.
//
// Requires E2E_TEST_EMAIL / E2E_TEST_PASSWORD to point at a real, already-created
// account (see scripts/create-test-user.mjs). Specs that need a signed-in session
// should import `test`/`expect` from this module instead of "@playwright/test", and
// guard their describe block with:
//
//   test.skip(!hasE2ECredentials, "Set E2E_TEST_EMAIL/E2E_TEST_PASSWORD to run this suite.");
//
// so the suite reports a clear skip reason instead of silently doing nothing when the
// env vars aren't set (e.g. on a contributor's machine or a PR from a fork).
import fs from "node:fs";
import path from "node:path";
import { test as base, expect } from "@playwright/test";

export const E2E_TEST_EMAIL = process.env.E2E_TEST_EMAIL;
export const E2E_TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

export const hasE2ECredentials = Boolean(E2E_TEST_EMAIL && E2E_TEST_PASSWORD);

const AUTH_DIR = path.join(__dirname, ".auth");

export const test = base.extend<Record<string, never>, { workerStorageState: string }>({
  storageState: ({ workerStorageState }, use) => use(workerStorageState),

  workerStorageState: [
    async ({ browser }, use, workerInfo) => {
      if (!hasE2ECredentials) {
        // Nothing to authenticate. Specs must guard with `test.skip(!hasE2ECredentials, ...)`
        // so they never actually run an unauthenticated page against these tests.
        await use("");
        return;
      }

      const fileName = path.join(AUTH_DIR, `${workerInfo.parallelIndex}.json`);
      if (fs.existsSync(fileName)) {
        await use(fileName);
        return;
      }

      const page = await browser.newPage();
      await page.goto("/login");
      await page.waitForLoadState("networkidle");
      await page.getByText("Nincs fiókod? Regisztrálj").waitFor({ state: "visible" }).catch(() => {});
      await page.getByPlaceholder("te@pelda.hu").fill(E2E_TEST_EMAIL!);
      await page.locator('input[type="password"]').fill(E2E_TEST_PASSWORD!);
      await page.getByRole("button", { name: "Bejelentkezés" }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });

      fs.mkdirSync(AUTH_DIR, { recursive: true });
      await page.context().storageState({ path: fileName });
      await page.close();
      await use(fileName);
    },
    { scope: "worker" },
  ],
});

export { expect };
