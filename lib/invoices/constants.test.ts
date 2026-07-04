// lib/invoices/constants.test.ts
import {
  INVOICE_LIST_LIMIT,
  INVOICE_LIST_MAX_LIMIT,
} from "@/lib/invoices/constants";

describe("invoice list constants", () => {
  it("uses a reasonable default page size", () => {
    expect(INVOICE_LIST_LIMIT).toBe(30);
    expect(INVOICE_LIST_MAX_LIMIT).toBeGreaterThan(INVOICE_LIST_LIMIT);
  });
});
