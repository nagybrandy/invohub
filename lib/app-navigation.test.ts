// lib/app-navigation.test.ts
import {
  ADMIN_NAV,
  DASHBOARD_FEATURE_NAV,
  getBreadcrumb,
  getDashboardFeatures,
  getMobileMoreNav,
  getSettingsBreadcrumbLabelKey,
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
    expect(SIDEBAR_SECONDARY_NAV.map((item) => item.href)).toEqual([routes.emailEditor, routes.dataExport, routes.bulkUpload, routes.import]);
  });

  it("does not include admin for a non-admin role", () => {
    const items = getSidebarSecondaryNav("entrepreneur", { importEnabled: true });
    expect(items.map((i) => i.href)).toEqual([routes.emailEditor, routes.dataExport, routes.bulkUpload, routes.import]);
  });

  it("appends the admin panel below the divider for admins", () => {
    const items = getSidebarSecondaryNav("admin", { importEnabled: true });
    expect(items.map((i) => i.href)).toEqual([routes.emailEditor, routes.dataExport, routes.bulkUpload, routes.import, routes.admin]);
  });

  it("hides Importálás unless the deploy turned it on — which is the default", () => {
    expect(getSidebarSecondaryNav("entrepreneur").map((i) => i.href)).toEqual([routes.emailEditor, routes.dataExport, routes.bulkUpload]);
    expect(getSidebarSecondaryNav("admin").map((i) => i.href)).toEqual([routes.emailEditor, routes.dataExport, routes.bulkUpload, routes.admin]);
    expect(getSidebarSecondaryNav("entrepreneur", { importEnabled: false }).map((i) => i.href)).toEqual([routes.emailEditor, routes.dataExport, routes.bulkUpload]);
  });
});

describe("MOBILE_TAB_NAV", () => {
  it("is Főoldal, Számlák, Új (centre), Partnerek, Továbbiak (SPEC §5.4)", () => {
    expect(MOBILE_TAB_NAV.map((item) => item.href ?? null)).toEqual([
      routes.dashboard,
      routes.invoices,
      null,
      routes.clients,
      null,
    ]);
    expect(MOBILE_TAB_NAV.map((item) => item.labelKey)).toEqual([
      "nav.dashboard",
      "nav.invoices",
      "nav.newShort",
      "nav.partners",
      "nav.more",
    ]);
  });

  it("the centre Új tab and Továbbiak open sheets instead of navigating", () => {
    expect(MOBILE_TAB_NAV.map((item) => item.action ?? null)).toEqual([null, null, "new", null, "more"]);
  });

  it("has exactly 5 tabs", () => {
    expect(MOBILE_TAB_NAV).toHaveLength(5);
  });
});

describe("MOBILE_MORE_NAV / getMobileMoreNav", () => {
  it("exposes receipts, products, export, import, and settings to entrepreneurs", () => {
    const items = getMobileMoreNav("entrepreneur", { importEnabled: true });
    expect(items.map((i) => i.href)).toEqual([
      routes.receipts,
      routes.products,
      routes.emailEditor,
      routes.dataExport,
      routes.bulkUpload,
      routes.import,
      routes.settings,
    ]);
  });

  it("appends the admin panel for admins", () => {
    const items = getMobileMoreNav("admin", { importEnabled: true });
    expect(items.map((i) => i.href)).toContain(routes.admin);
    expect(items).toHaveLength(MOBILE_MORE_NAV.length + 1);
  });

  it("drops Importálás from the sheet by default", () => {
    expect(getMobileMoreNav("entrepreneur").map((i) => i.href)).toEqual([
      routes.receipts,
      routes.products,
      routes.emailEditor,
      routes.dataExport,
      routes.bulkUpload,
      routes.settings,
    ]);
  });
});

describe("getDashboardFeatures", () => {
  it("drops the import card by default", () => {
    expect(getDashboardFeatures("entrepreneur").map((f) => f.href)).toEqual([routes.products, routes.receipts]);
  });

  it("exposes products, receipts, and import to entrepreneurs", () => {
    const features = getDashboardFeatures("entrepreneur", { importEnabled: true });
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

describe("e-mail editor page title", () => {
  it("maps /email-editor to its nav label", () => {
    expect(getPageTitleLabelKey("/email-editor")).toBe("nav.emailEditor");
  });
});

describe("settings subpages", () => {
  it("knows the appearance and NAV pages the settings track will create", () => {
    expect(getSettingsBreadcrumbLabelKey("/settings/appearance")).toBe("nav.settingsAppearance");
    expect(getSettingsBreadcrumbLabelKey("/settings/nav")).toBe("nav.settingsNav");
    expect(getSettingsBreadcrumbLabelKey("/settings")).toBeUndefined();
  });
});

describe("getBreadcrumb", () => {
  const t = (key: string) => key;
  const labels = (pathname: string, options?: Parameters<typeof getBreadcrumb>[2]) =>
    getBreadcrumb(pathname, t, options)?.map((item) => item.label);

  it("has no trail on top-level screens", () => {
    for (const path of ["/dashboard", "/invoices", "/receipts", "/clients", "/products", "/settings", "/export", "/bulk", "/email-editor", "/admin"]) {
      expect(getBreadcrumb(path, t)).toBeUndefined();
    }
  });

  it("builds the new-record trails", () => {
    expect(labels("/invoices/new")).toEqual(["nav.invoices", "nav.breadcrumb.new"]);
    expect(labels("/receipts/new")).toEqual(["nav.receipts", "nav.breadcrumb.new"]);
    expect(labels("/clients/new")).toEqual(["nav.partners", "nav.breadcrumb.new"]);
  });

  it("builds detail and edit trails, linking every ancestor", () => {
    expect(labels("/invoices/abc")).toEqual(["nav.invoices", "nav.breadcrumb.invoice"]);
    expect(labels("/receipts/abc")).toEqual(["nav.receipts", "nav.breadcrumb.receipt"]);
    const edit = getBreadcrumb("/invoices/abc/edit", t)!;
    expect(edit.map((i) => i.label)).toEqual(["nav.invoices", "nav.breadcrumb.invoice", "nav.breadcrumb.edit"]);
    expect(edit[0].href).toBe(routes.invoices);
    expect(edit[1].href).toBe("/invoices/abc");
    expect(edit[2].href).toBeUndefined();
  });

  it("partners and products have no detail page: their edit page is the record", () => {
    expect(labels("/clients/c1/edit")).toEqual(["nav.partners", "nav.breadcrumb.partner"]);
    expect(labels("/products/p1/edit")).toEqual(["nav.products", "nav.breadcrumb.product"]);
  });

  it("recurring invoice pages hang under Számlák and are never read as an invoice id", () => {
    expect(labels("/invoices/recurring")).toEqual(["nav.invoices", "nav.recurringInvoices"]);
    expect(labels("/invoices/recurring/new")).toEqual(["nav.invoices", "nav.recurringInvoices", "nav.breadcrumb.new"]);
    const edit = getBreadcrumb("/invoices/recurring/tpl-1", t)!;
    expect(edit.map((i) => i.label)).toEqual(["nav.invoices", "nav.recurringInvoices", "nav.breadcrumb.edit"]);
    expect(edit[0].href).toBe(routes.invoices);
    expect(edit[1].href).toBe(routes.recurringInvoices);
  });

  it("settings subpages hang under Beállítások", () => {
    const trail = getBreadcrumb("/settings/company", t)!;
    expect(trail.map((i) => i.label)).toEqual(["nav.settings", "settings.company"]);
    expect(trail[0].href).toBe(routes.settings);
    expect(labels("/settings/appearance")).toEqual(["nav.settings", "nav.settingsAppearance"]);
    expect(labels("/settings/nav")).toEqual(["nav.settings", "nav.settingsNav"]);
    expect(labels("/settings/api-keys")).toEqual(["nav.settings", "settings.apiKeys"]);
  });

  it("lets the screen name the current record and optionally prepend Főoldal", () => {
    expect(labels("/invoices/abc", { currentLabel: "INV-2026-0042" })).toEqual(["nav.invoices", "INV-2026-0042"]);
    expect(labels("/invoices/new", { includeHome: true, currentLabel: "Új számla" })).toEqual([
      "nav.dashboard",
      "nav.invoices",
      "Új számla",
    ]);
    expect(getBreadcrumb("/invoices/new", t, { includeHome: true })![0].href).toBe(routes.dashboard);
  });

  it("ignores a trailing slash and unknown routes", () => {
    expect(labels("/invoices/new/")).toEqual(["nav.invoices", "nav.breadcrumb.new"]);
    expect(getBreadcrumb("/onboarding", t)).toBeUndefined();
  });
});
