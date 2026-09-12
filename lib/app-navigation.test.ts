// lib/app-navigation.test.ts
import {
  DASHBOARD_FEATURE_NAV,
  DESKTOP_TOP_NAV,
  getDashboardFeatures,
  getDesktopNavItems,
  isNavActive,
  MOBILE_TAB_NAV,
} from "@/lib/app-navigation";
import { routes } from "@/lib/navigation";

describe("MOBILE_TAB_NAV", () => {
  it("puts EV daily work first with new invoice in the center", () => {
    expect(MOBILE_TAB_NAV.map((item) => item.href)).toEqual([
      routes.invoices,
      routes.clients,
      routes.newInvoice,
      routes.dashboard,
      routes.settings,
    ]);
  });
});

describe("DESKTOP_TOP_NAV", () => {
  it("leads with invoices for EV billing", () => {
    expect(DESKTOP_TOP_NAV.map((item) => item.href)).toEqual([
      routes.invoices,
      routes.dashboard,
      routes.settings,
    ]);
  });
});

describe("getDashboardFeatures", () => {
  it("exposes products, receipts, and import to entrepreneurs", () => {
    const features = getDashboardFeatures("entrepreneur");
    expect(features.map((f) => f.href)).toEqual([
      routes.products,
      routes.receipts,
      routes.import,
    ]);
  });

  it("includes admin panel for admin", () => {
    const features = getDashboardFeatures("admin");
    expect(features.map((f) => f.href)).toContain(routes.admin);
  });
});

describe("getDesktopNavItems", () => {
  it("keeps settings once and includes EV secondary features", () => {
    const items = getDesktopNavItems("entrepreneur");
    const settingsCount = items.filter((i) => i.href === routes.settings).length;
    expect(settingsCount).toBe(1);
    expect(items.map((i) => i.href)).toEqual([
      routes.invoices,
      routes.clients,
      routes.newInvoice,
      routes.dashboard,
      routes.products,
      routes.receipts,
      routes.import,
      routes.settings,
    ]);
  });

  it("includes admin link for admin users", () => {
    const items = getDesktopNavItems("admin");
    expect(items.some((i) => i.href === routes.admin)).toBe(true);
    expect(items).toHaveLength(9);
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

describe("DASHBOARD_FEATURE_NAV", () => {
  it("does not gate secondary features on accountant role", () => {
    expect(DASHBOARD_FEATURE_NAV.every((item) => !("accountantOnly" in item))).toBe(
      true,
    );
  });
});
