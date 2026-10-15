// lib/nav/bank-account.test.ts
import { formatNavBankAccountNumber, isNavBankAccountNumber } from "@/lib/nav/bank-account";

describe("formatNavBankAccountNumber — the shapes NAV's BankAccountNumberType accepts", () => {
  it("hyphenates a 24-digit GIRO number typed without separators (the first live rejection)", () => {
    expect(formatNavBankAccountNumber("117421802146201600000000")).toBe("11742180-21462016-00000000");
  });

  it("hyphenates a 16-digit number and accepts spaces as separators", () => {
    expect(formatNavBankAccountNumber("1174218021462016")).toBe("11742180-21462016");
    expect(formatNavBankAccountNumber("11742180 21462016 00000000")).toBe("11742180-21462016-00000000");
  });

  it("keeps an already valid hyphenated number", () => {
    expect(formatNavBankAccountNumber("12345678-12345678")).toBe("12345678-12345678");
    expect(formatNavBankAccountNumber("12345678-12345678-12345678")).toBe("12345678-12345678-12345678");
  });

  it("compacts and upper-cases an IBAN", () => {
    expect(formatNavBankAccountNumber("hu42 1177 3016 1111 1018 0000 0000")).toBe("HU42117730161111101800000000");
    expect(isNavBankAccountNumber("HU42117730161111101800000000")).toBe(true);
  });

  it("returns null for what cannot be made valid, so the optional element is omitted instead of rejected", () => {
    expect(formatNavBankAccountNumber("1234")).toBeNull();
    expect(formatNavBankAccountNumber("")).toBeNull();
    expect(formatNavBankAccountNumber(null)).toBeNull();
    expect(formatNavBankAccountNumber("12345678-1234567")).toBeNull();
  });
});
