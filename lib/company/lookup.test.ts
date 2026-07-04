// lib/company/lookup.test.ts
import { lookupCompanyByTaxNumber } from "@/lib/company/lookup";

describe("lookupCompanyByTaxNumber", () => {
  it("returns null for empty input", async () => {
    expect(await lookupCompanyByTaxNumber("")).toBeNull();
    expect(await lookupCompanyByTaxNumber("   ")).toBeNull();
  });

  it("returns mock company for known tax number", async () => {
    const result = await lookupCompanyByTaxNumber("12345678-1-23");
    expect(result).toMatchObject({
      name: "Demo Kft.",
      taxNumber: "12345678-1-23",
      country: "HU",
    });
  });

  it("trims whitespace before lookup", async () => {
    const result = await lookupCompanyByTaxNumber("  98765432-2-43  ");
    expect(result?.name).toBe("Sample Zrt.");
  });

  it("returns partial stub for valid HU format unknown number", async () => {
    const result = await lookupCompanyByTaxNumber("11111111-1-11");
    expect(result).toEqual({
      name: "",
      taxNumber: "11111111-1-11",
      country: "HU",
    });
  });

  it("returns null for invalid format", async () => {
    expect(await lookupCompanyByTaxNumber("invalid")).toBeNull();
  });
});
