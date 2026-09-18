// lib/nav-receipt/taxpayer.test.ts
import { toTaxpayerId } from "@/lib/nav-receipt/taxpayer";

describe("toTaxpayerId", () => {
  it("extracts the 8-digit core from a full OSA-style tax number", () => {
    expect(toTaxpayerId("12345678-1-42")).toBe("12345678");
  });

  it("extracts the 8-digit core from a digits-only 11-char tax number", () => {
    expect(toTaxpayerId("12345678142")).toBe("12345678");
  });

  it("extracts the 8-digit core from a space-separated tax number", () => {
    expect(toTaxpayerId("12345678 1 42")).toBe("12345678");
  });

  it("returns an already-8-digit tax number unchanged", () => {
    expect(toTaxpayerId("12345678")).toBe("12345678");
  });

  it("always returns a value matching the TaxpayerIdType pattern", () => {
    for (const raw of ["12345678-1-42", "12345678142", "12345678 1 42", "12345678"]) {
      expect(toTaxpayerId(raw)).toMatch(/^[0-9]{8}$/);
    }
  });

  it("throws for a value with fewer than 8 leading digits", () => {
    expect(() => toTaxpayerId("1234567")).toThrow();
    expect(() => toTaxpayerId("")).toThrow();
    expect(() => toTaxpayerId("abcdefg")).toThrow();
  });
});
