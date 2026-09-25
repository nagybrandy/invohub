// lib/nav/nav-error-i18n.test.ts
import en from "@/lib/i18n/locales/en";
import hu from "@/lib/i18n/locales/hu";
import { flattenTranslationKeys } from "@/lib/i18n/flatten-keys";
import { NAV_RESULT_I18N_KEY, navResultI18nKey } from "@/lib/nav/nav-error-i18n";

const huKeys = flattenTranslationKeys(hu);
const enKeys = flattenTranslationKeys(en);

describe("navResultI18nKey", () => {
  it("maps a known code to its key", () => {
    expect(navResultI18nKey("draftNotSubmittable")).toBe(
      NAV_RESULT_I18N_KEY.draftNotSubmittable
    );
  });

  it("falls back for an unknown or absent code, so the UI never shows a raw server string", () => {
    expect(navResultI18nKey("somethingNewFromTheServer")).toBe("invoices.nav.submitFailed");
    expect(navResultI18nKey(undefined)).toBe("invoices.nav.submitFailed");
    expect(navResultI18nKey("", "settings.nav.checkFailed")).toBe("settings.nav.checkFailed");
  });
});

describe("NAV_RESULT_I18N_KEY", () => {
  it("points every code at a key that exists in both locales", () => {
    const missing = Object.entries(NAV_RESULT_I18N_KEY)
      .flatMap(([code, key]) => [
        huKeys.has(key) ? null : `hu is missing ${key} (code: ${code})`,
        enKeys.has(key) ? null : `en is missing ${key} (code: ${code})`,
      ])
      .filter(Boolean);
    expect(missing).toEqual([]);
  });

  it("covers every code the NAV and M2M routes can answer with", () => {
    // Keep this list in step with the routes: a code with no mapping would
    // silently degrade to the generic fallback.
    const codesTheRoutesSend = [
      "demoAvailable",
      "sharedTestAccountConnected",
      "productionConnected",
      "testConnected",
      "credentialsMissing",
      "checkFailed",
      "draftNotSubmittable",
      "proformaNotSubmittable",
      "missingExchangeRate",
      "navSubmitFailed",
      "noSubmission",
      "statusQueryFailed",
      "productionNotEnabled",
      "m2mDemoAvailable",
      "m2mTestConnected",
      "receiptAlreadySubmitted",
    ];
    const unmapped = codesTheRoutesSend.filter((c) => !(c in NAV_RESULT_I18N_KEY));
    expect(unmapped).toEqual([]);
  });
});
