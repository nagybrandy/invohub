// lib/companies/completeness.test.ts
import {
  COMPANY_PROFILE_REQUIRED_FIELDS,
  getMissingCompanyProfileFields,
  isCompanyProfileComplete,
} from "@/lib/companies/completeness";

const COMPLETE = {
  name: "Acme Kft.",
  taxNumber: "12345678-1-23",
  zipCode: "1011",
  city: "Budapest",
  address: "Fő utca 1.",
};

describe("isCompanyProfileComplete / getMissingCompanyProfileFields", () => {
  it("is complete when all five required fields are filled in", () => {
    expect(isCompanyProfileComplete(COMPLETE)).toBe(true);
    expect(getMissingCompanyProfileFields(COMPLETE)).toEqual([]);
  });

  it("treats null as fully incomplete (no company row yet)", () => {
    expect(isCompanyProfileComplete(null)).toBe(false);
    expect(getMissingCompanyProfileFields(null)).toEqual([...COMPANY_PROFILE_REQUIRED_FIELDS]);
  });

  it("treats undefined the same as null", () => {
    expect(isCompanyProfileComplete(undefined)).toBe(false);
    expect(getMissingCompanyProfileFields(undefined)).toEqual([
      ...COMPANY_PROFILE_REQUIRED_FIELDS,
    ]);
  });

  it("reports a single missing field", () => {
    const { taxNumber, ...rest } = COMPLETE;
    expect(taxNumber).toBeDefined();
    expect(isCompanyProfileComplete(rest)).toBe(false);
    expect(getMissingCompanyProfileFields(rest)).toEqual(["taxNumber"]);
  });

  it("treats a whitespace-only field as missing", () => {
    const withBlankCity = { ...COMPLETE, city: "   " };
    expect(isCompanyProfileComplete(withBlankCity)).toBe(false);
    expect(getMissingCompanyProfileFields(withBlankCity)).toEqual(["city"]);
  });

  it("treats an empty string field as missing", () => {
    const withEmptyAddress = { ...COMPLETE, address: "" };
    expect(getMissingCompanyProfileFields(withEmptyAddress)).toEqual(["address"]);
  });

  it("reports fields in a stable declared order regardless of which are missing", () => {
    expect(getMissingCompanyProfileFields({})).toEqual([...COMPANY_PROFILE_REQUIRED_FIELDS]);
  });

  it("does not require euVatNumber, country, bankAccount or any other field", () => {
    expect(isCompanyProfileComplete({ ...COMPLETE })).toBe(true);
  });
});
