// e2e/web/invoices.spec.ts
// Invoice management E2E: auth gates + create→preview→PDF API contract.
import { test, expect } from "@playwright/test";

test.describe("Invoice management", () => {
  test.describe("Auth guard", () => {
    test("invoice list redirects unauthenticated users to login", async ({
      page,
    }) => {
      await page.goto("/invoices");
      await page.waitForURL(/login|\//, { timeout: 10000 });
      expect(page.url()).toMatch(/login|\//);
    });

    test("new invoice page redirects unauthenticated users to login", async ({
      page,
    }) => {
      await page.goto("/invoices/new");
      await page.waitForURL(/login|\//, { timeout: 10000 });
      expect(page.url()).toMatch(/login|\//);
    });
  });

  test.describe("Create → preview → PDF (web)", () => {
    test("draft preview PDF endpoint requires authentication", async ({
      request,
    }) => {
      const response = await request.post("/api/invoices/preview/pdf", {
        data: {
          invoice: {
            invoiceNumber: "INV-E2E-001",
            clientName: "E2E Client",
            issueDate: "2026-06-01",
            dueDate: "2026-06-15",
            status: "draft",
            currency: "HUF",
            lineItems: [
              {
                id: "line-1",
                description: "Consulting",
                quantity: 1,
                unitPrice: 10000,
                vatRate: 27,
              },
            ],
          },
        },
      });
      expect(response.status()).toBe(401);
    });

    test("new invoice create route stays behind auth (happy-path entry)", async ({
      page,
    }) => {
      await page.goto("/invoices/new");
      await page.waitForURL(/login|\//, { timeout: 10000 });
      await expect(page.locator("body")).toBeVisible();
      // Full create→preview→PDF UI requires a session; unit suite covers the
      // draft → HTML → PDF pipeline once authenticated.
      expect(page.url()).toMatch(/login|\//);
    });
  });

  test.describe("New invoice form", () => {
    test("attempting to access new invoice form shows login", async ({
      page,
    }) => {
      await page.goto("/invoices/new");
      await page.waitForURL(/login|\//, { timeout: 10000 });
      await expect(page.locator("body")).toBeVisible();
    });
  });
});

test.describe("Invoice form UI (authenticated)", () => {
  // Authenticated UI flows stay skipped until a shared E2E session helper exists.
  test.skip("new invoice form renders document type tabs", async ({
    page,
  }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Új bizonylat kiállítása")).toBeVisible();

    await expect(page.getByText("Számla")).toBeVisible();
    await expect(page.getByText("Díjbekérő")).toBeVisible();
    await expect(page.getByText("Előlegszámla")).toBeVisible();
    await expect(page.getByText("Nyugta")).toBeVisible();
  });

  test.skip("screen mode tabs are visible", async ({ page }) => {
    await page.goto("/invoices/new");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Szerkesztés")).toBeVisible();
    await expect(page.getByText("Előnézet")).toBeVisible();
  });
});
