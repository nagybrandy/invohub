// lib/i18n/locales/parity.test.ts
// Hungarian is the primary locale (InvoHub is an EV product), English is the
// second. AGENTS.md's rule is that a user-facing string lands in BOTH files
// in the same change — this is what makes that rule fail loudly instead of
// surfacing as a raw key on someone's screen weeks later.
import en from "@/lib/i18n/locales/en";
import hu from "@/lib/i18n/locales/hu";
import { flattenTranslationKeys } from "@/lib/i18n/flatten-keys";

const huKeys = flattenTranslationKeys(hu);
const enKeys = flattenTranslationKeys(en);

describe("hu/en key parity", () => {
  it("has an English string for every Hungarian key", () => {
    const missing = [...huKeys.keys()].filter((k) => !enKeys.has(k));
    expect(missing).toEqual([]);
  });

  it("has a Hungarian string for every English key", () => {
    const missing = [...enKeys.keys()].filter((k) => !huKeys.has(k));
    expect(missing).toEqual([]);
  });

  it("keeps both files the same shape — no key is an object on one side and a string on the other", () => {
    const mismatched = [...huKeys.entries()]
      .filter(([key, value]) => enKeys.has(key) && typeof enKeys.get(key) !== typeof value)
      .map(([key]) => key);
    expect(mismatched).toEqual([]);
  });

  it("carries the same interpolation placeholders on both sides", () => {
    // t("invoices.sendEmailLabel", { email }) renders nothing useful if one
    // locale spells the placeholder differently or drops it.
    const placeholders = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();
    const drifted = [...huKeys.entries()]
      .filter(([key, value]) => {
        const other = enKeys.get(key);
        if (typeof other !== "string" || typeof value !== "string") return false;
        return placeholders(value).join(",") !== placeholders(other).join(",");
      })
      .map(([key, value]) => `${key}: hu=${placeholders(value as string)} en=${placeholders(enKeys.get(key) as string)}`);
    expect(drifted).toEqual([]);
  });

  it("has no empty string on either side", () => {
    const empty = [
      ...[...huKeys.entries()].filter(([, v]) => typeof v === "string" && v.trim() === "").map(([k]) => `hu:${k}`),
      ...[...enKeys.entries()].filter(([, v]) => typeof v === "string" && v.trim() === "").map(([k]) => `en:${k}`),
    ];
    expect(empty).toEqual([]);
  });
});
