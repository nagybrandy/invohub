import {
  SETTINGS_NAV_ITEMS,
  filterSettingsNav,
  normalizeSearch,
  settingsItemKeys,
  settingsNavKeyForPath,
} from "@/lib/settings-navigation";
import { routes } from "@/lib/navigation";
import hu from "@/lib/i18n/locales/hu";

const t = (key: string) =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], hu) as string;

describe("SETTINGS_NAV_ITEMS", () => {
  it("lists the nine pages in design order with API kulcsok last, after the divider", () => {
    expect(SETTINGS_NAV_ITEMS.map((item) => item.key)).toEqual([
      "company",
      "billing",
      "pdf",
      "templates",
      "reminders",
      "nav",
      "access",
      "appearance",
      "apiKeys",
    ]);
    expect(SETTINGS_NAV_ITEMS.filter((item) => item.group === "after").map((item) => item.key)).toEqual(["apiKeys"]);
  });

  it("uses the shared route constants", () => {
    const byKey = Object.fromEntries(SETTINGS_NAV_ITEMS.map((item) => [item.key, item.href]));
    expect(byKey.nav).toBe(routes.settingsNav);
    expect(byKey.appearance).toBe(routes.settingsAppearance);
    expect(byKey.company).toBe(routes.settingsCompany);
  });

  it("has a title, description and lead string for every item", () => {
    for (const item of SETTINGS_NAV_ITEMS) {
      const keys = settingsItemKeys(item.key);
      expect(typeof t(keys.title)).toBe("string");
      expect(typeof t(keys.description)).toBe("string");
      expect(typeof t(keys.lead)).toBe("string");
    }
  });
});

describe("settingsNavKeyForPath", () => {
  it("maps pages to their nav row", () => {
    expect(settingsNavKeyForPath("/settings/company")).toBe("company");
    expect(settingsNavKeyForPath("/settings/api-keys")).toBe("apiKeys");
    expect(settingsNavKeyForPath("/settings/nav/")).toBe("nav");
  });

  it("treats the e-mail editor as E-mailek szövege and the hub as no row", () => {
    expect(settingsNavKeyForPath("/email-editor")).toBe("templates");
    expect(settingsNavKeyForPath("/settings")).toBeUndefined();
    expect(settingsNavKeyForPath("/invoices")).toBeUndefined();
  });
});

describe("filterSettingsNav", () => {
  it("returns every item for an empty or blank query", () => {
    expect(filterSettingsNav(SETTINGS_NAV_ITEMS, "", t)).toHaveLength(SETTINGS_NAV_ITEMS.length);
    expect(filterSettingsNav(SETTINGS_NAV_ITEMS, "   ", t)).toHaveLength(SETTINGS_NAV_ITEMS.length);
  });

  it("matches titles regardless of case and accents", () => {
    expect(filterSettingsNav(SETTINGS_NAV_ITEMS, "ceges", t).map((i) => i.key)).toContain("company");
    expect(filterSettingsNav(SETTINGS_NAV_ITEMS, "NYELV", t).map((i) => i.key)).toContain("appearance");
    expect(filterSettingsNav(SETTINGS_NAV_ITEMS, "api", t).map((i) => i.key)).toContain("apiKeys");
  });

  it("also searches the one-line description", () => {
    // "Mód, belépés, XML export." sits under NAV.
    expect(filterSettingsNav(SETTINGS_NAV_ITEMS, "xml", t).map((i) => i.key)).toContain("nav");
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterSettingsNav(SETTINGS_NAV_ITEMS, "zzzzqq", t)).toEqual([]);
  });
});

describe("normalizeSearch", () => {
  it("strips accents and lower-cases", () => {
    expect(normalizeSearch("  Számlázófiókok Őű ")).toBe("szamlazofiokok ou");
  });
});
