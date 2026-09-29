// lib/nav/country-code.test.ts
import { isEuCountryCode, toIsoCountryCode, countryCodeFromVatNumber } from "@/lib/nav/country-code";

describe("toIsoCountryCode", () => {
  it.each([
    ["HU", "HU"],
    ["hu", "HU"],
    ["Magyarország", "HU"],
    ["Hungary", "HU"],
    ["Németország", "DE"],
    ["Germany", "DE"],
    ["Ausztria", "AT"],
    ["Szlovákia", "SK"],
    ["Románia", "RO"],
    ["Egyesült Királyság", "GB"],
    ["USA", "US"],
    ["Svájc", "CH"],
    ["DE", "DE"],
  ])("maps %s to %s", (input, expected) => {
    expect(toIsoCountryCode(input)).toBe(expected);
  });

  it("returns null for blank or unknown values instead of guessing", () => {
    expect(toIsoCountryCode(undefined)).toBeNull();
    expect(toIsoCountryCode("")).toBeNull();
    expect(toIsoCountryCode("Atlantisz")).toBeNull();
  });
});

describe("isEuCountryCode", () => {
  it("knows the EU-27 members and rejects non-members", () => {
    expect(isEuCountryCode("DE")).toBe(true);
    expect(isEuCountryCode("HU")).toBe(true);
    expect(isEuCountryCode("GR")).toBe(true);
    expect(isEuCountryCode("GB")).toBe(false);
    expect(isEuCountryCode("CH")).toBe(false);
    expect(isEuCountryCode("US")).toBe(false);
  });
});

describe("countryCodeFromVatNumber", () => {
  it("reads the two-letter prefix of an EU VAT number, mapping Greece's EL to GR", () => {
    expect(countryCodeFromVatNumber("DE123456789")).toBe("DE");
    expect(countryCodeFromVatNumber("el123456789")).toBe("GR");
    expect(countryCodeFromVatNumber("123")).toBeNull();
    expect(countryCodeFromVatNumber(undefined)).toBeNull();
  });
});
