// lib/invoices/pdf-layout.test.ts
import { companyInitials } from "@/lib/invoices/pdf-layout";

describe("companyInitials", () => {
  it("uses first letters of first two words", () => {
    expect(companyInitials("InvoHub Demo Kft.")).toBe("ID");
  });

  it("uses first two letters for single word", () => {
    expect(companyInitials("Acme")).toBe("AC");
  });

  it("returns fallback for empty name", () => {
    expect(companyInitials("   ")).toBe("?");
  });
});
