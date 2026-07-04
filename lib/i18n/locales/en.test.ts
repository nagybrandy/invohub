// lib/i18n/locales/en.test.ts
import en from "@/lib/i18n/locales/en";

describe("i18n en locale", () => {
  it("defines navigation keys", () => {
    expect(en.nav.invoices).toBe("Invoices");
    expect(en.nav.dashboard).toBe("Dashboard");
    expect(en.settings.darkMode).toBe("Dark mode");
  });
});
