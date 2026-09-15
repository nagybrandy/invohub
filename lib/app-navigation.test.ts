// lib/app-navigation.test.ts
import {
  ADMIN_NAV,
  DASHBOARD_FEATURE_NAV,
  getDashboardFeatures,
  getMobileMoreNav,
  getPageTitleLabelKey,
  getSidebarSecondaryNav,
  isNavActive,
  MOBILE_MORE_NAV,
  MOBILE_TAB_NAV,
  SIDEBAR_PRIMARY_NAV,
  SIDEBAR_SECONDARY_NAV,
} from "@/lib/app-navigation";
import { routes } from "@/lib/navigation";

describe("SIDEBAR_PRIMARY_NAV", () => {
  it("has exactly the six owner-ordered primary sections", () => {
    expect(SIDEBAR_PRIMARY_NAV.map((item) => item.href)).toEqual([
      routes.dashboard,
      routes.invoices,
      routes.receipts,
      routes.clients,
      routes.products,
      routes.settings,
    ]);
  });

  it("labels the clients route as nav.partners, not nav.clients", () => {
    const partnersItem = SIDEBAR_PRIMARY_NAV.find((item) => item.href === routes.clients);
    expect(partnersItem?.labelKey).toBe("nav.partners");
  });
});

describe("SIDEBAR_SECONDARY_NAV / getSidebarSecondaryNav", () => {
  it("carries Importálás below the divider for every role", () => {
    expect(SIDEBAR_SECONDARY_NAV.map((item) => item.href)).toEqual([routes.import]);
  });

  it("does not include admin for a non-admin role", () => {
    const items = getSidebarSecondaryNav("entrepreneur");
    expect(items.map((i) => i.href)).toEqual([routes.import]);
  });

  it("appends the admin panel below the divider for admins", () => {
    const items = getSidebarSecondaryNav("admin");
    expect(items.map((i) => i.href)).toEqual([routes.import, routes.admin]);
  });
});

describe("MOBILE_TAB_NAV", () => {
  it("puts EV daily work first with new invoice in the center and 'Továbbiak' last", () => {
    expect(MOBILE_TAB_NAV.map((item) => item.href ?? null)).toEqual([
      routes.invoices,
      routes.clients,
      routes.newInvoice,
      routes.dashboard,
      null,
    ]);
    expect(MOBILE_TAB_NAV.map((item) => item.labelKey)).toEqual([
      "nav.invoices",
      "nav.partners",
      "nav.newInvoice",
      "nav.dashboard",
      "nav.more",
    ]);
  });

  it("has exactly 5 tabs", () => {
    expect(MOBILE_TAB_NAV).toHaveLength(5);
  });
});

describe("MOBILE_MORE_NAV / getMobileMoreNav", () => {
  it("exposes receipts, products, import, and settings to entrepreneurs", () => {
    const items = getMobileMoreNav("entrepreneur");
    expect(items.map((i) => i.href)).toEqual([
      routes.receipts,
      routes.products,
      routes.import,
      routes.settings,
    ]);
  });

  it("appends the admin panel for admins", () => {
    const items = getMobileMoreNav("admin");
    expect(items.map((i) => i.href)).toContain(routes.admin);
    expect(items).toHaveLength(MOBILE_MORE_NAV.length + 1);
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

describe("isNavActive", () => {
  it("matches dashboard exactly", () => {
    expect(isNavActive("/dashboard", routes.dashboard)).toBe(true);
    expect(isNavActive("/dashboard/extra", routes.dashboard)).toBe(false);
  });

  it("matches settings and admin subtrees", () => {
    expect(isNavActive("/settings/company", routes.settings)).toBe(true);
    expect(isNavActive("/settings/pdf", routes.settings)).toBe(true);
    expect(isNavActive("/admin", routes.admin)).toBe(true);
  });

  it("matches invoice detail under invoices", () => {
    expect(isNavActive("/invoices/abc-123", routes.invoices)).toBe(true);
  });

  it("matches receipt detail under receipts", () => {
    expect(isNavActive("/receipts/abc-123", routes.receipts)).toBe(true);
  });

  it("matches the clients (Partnerek) route", () => {
    expect(isNavActive("/clients", routes.clients)).toBe(true);
    expect(isNavActive("/clients/abc/edit", routes.clients)).toBe(true);
    expect(isNavActive("/products", routes.clients)).toBe(false);
  });
});

describe("DASHBOARD_FEATURE_NAV", () => {
  it("does not gate secondary features on accountant role", () => {
    expect(DASHBOARD_FEATURE_NAV.every((item) => !("accountantOnly" in item))).toBe(
      true,
    );
  });
});

describe("getPageTitleLabelKey", () => {
  it("labels each top-level screen with its sidebar section", () => {
    expect(getPageTitleLabelKey("/dashboard")).toBe("nav.dashboard");
    expect(getPageTitleLabelKey("/invoices")).toBe("nav.invoices");
    expect(getPageTitleLabelKey("/receipts")).toBe("nav.receipts");
    expect(getPageTitleLabelKey("/clients")).toBe("nav.partners");
    expect(getPageTitleLabelKey("/products")).toBe("nav.products");
    expect(getPageTitleLabelKey("/settings")).toBe("nav.settings");
    expect(getPageTitleLabelKey("/import")).toBe("nav.import");
    expect(getPageTitleLabelKey("/admin")).toBe("nav.admin");
  });

  it("labels detail/sub-pages with their parent section", () => {
    expect(getPageTitleLabelKey("/invoices/abc-123")).toBe("nav.invoices");
    expect(getPageTitleLabelKey("/invoices/new")).toBe("nav.invoices");
    expect(getPageTitleLabelKey("/settings/company")).toBe("nav.settings");
  });

  it("returns undefined for a route outside the sidebar nav", () => {
    expect(getPageTitleLabelKey("/onboarding")).toBeUndefined();
  });
});

describe("ADMIN_NAV", () => {
  it("points at the admin route and is marked adminOnly", () => {
    expect(ADMIN_NAV.href).toBe(routes.admin);
    expect(ADMIN_NAV.adminOnly).toBe(true);
  });
});
