// lib/import/import-flag.test.ts
import { isInvoiceImportEnabled } from "@/lib/import/import-flag";

describe("isInvoiceImportEnabled", () => {
  it("is off unless the deploy says exactly 'true'", () => {
    expect(isInvoiceImportEnabled({})).toBe(false);
    expect(isInvoiceImportEnabled({ EXPO_PUBLIC_ENABLE_INVOICE_IMPORT: "1" })).toBe(false);
    expect(isInvoiceImportEnabled({ EXPO_PUBLIC_ENABLE_INVOICE_IMPORT: "yes" })).toBe(false);
  });

  it("is on for 'true'", () => {
    expect(isInvoiceImportEnabled({ EXPO_PUBLIC_ENABLE_INVOICE_IMPORT: "true" })).toBe(true);
  });
});
