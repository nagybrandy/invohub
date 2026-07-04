// lib/app-navigation.test.ts
import {
  DASHBOARD_FEATURE_NAV,
  getDashboardFeatures,
  getDesktopNavItems,
  isNavActive,
  MOBILE_TAB_NAV,
} from "@/lib/app-navigation";
import { routes } from "@/lib/navigation";

describe("MOBILE_TAB_NAV", () => {
  it("exposes five primary tabs including receipts and settings", () => {
    expect(MOBILE_TAB_NAV).toHaveLength(5);
    expect(MOBILE_TAB_NAV.map((item) => item.href)).toEqual([
      routes.dashboard,
      routes.invoices,
      routes.receipts,
      routes.newInvoice,
      routes.settings,
    ]);
  });
});

describe("getDashboardFeatures", () => {
  it("hides accountant-only items for entrepreneurs", () => {
    const features = getDashboardFeatures("entrepreneur");
    const hrefs = features.map((f) => f.href);
    expect(hrefs).toContain(routes.import);
    expect(hrefs).not.toContain(routes.receipts);
    expect(hrefs).not.toContain(routes.clients);
    expect(hrefs).not.toContain(routes.products);
  });

  it("includes clients and products for accountants", () => {
    const features = getDashboardFeatures("accountant");
    const hrefs = features.map((f) => f.href);
    expect(hrefs).toContain(routes.clients);
    expect(hrefs).toContain(routes.products);
  });

  it("includes admin panel and all features for admin", () => {
    const features = getDashboardFeatures("admin");
    const hrefs = features.map((f) => f.href);
    expect(hrefs).toContain(routes.clients);
    expect(hrefs).toContain(routes.products);
    expect(hrefs).toContain(routes.admin);
  });
});

describe("getDesktopNavItems", () => {
  it("merges tabs, dashboard features, and settings once for accountant", () => {
    const items = getDesktopNavItems("accountant");
    const settingsCount = items.filter((i) => i.href === routes.settings).length;
    expect(settingsCount).toBe(1);
    expect(items.length).toBe(8);
  });

  it("includes admin link for admin users", () => {
    const items = getDesktopNavItems("admin");
    expect(items.some((i) => i.href === routes.admin)).toBe(true);
    expect(items.length).toBe(9);
  });
});

describe("isNavActive", () => {
  it("matches dashboard exactly", () => {
    expect(isNavActive("/dashboard", routes.dashboard)).toBe(true);
    expect(isNavActive("/dashboard/extra", routes.dashboard)).toBe(false);
  });

  it("matches settings and admin subtrees", () => {
    expect(isNavActive("/settings/company", routes.settings)).toBe(true);
    expect(isNavActive("/admin", routes.admin)).toBe(true);
  });

  it("matches invoice detail under invoices", () => {
    expect(isNavActive("/invoices/abc-123", routes.invoices)).toBe(true);
  });

  it("matches receipt detail under receipts", () => {
    expect(isNavActive("/receipts/abc-123", routes.receipts)).toBe(true);
  });
});
