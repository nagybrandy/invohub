// lib/dashboard/money-parts.test.ts
import { splitMoney } from "@/lib/dashboard/money-parts";

describe("splitMoney", () => {
  it("splits the forint suffix from the number", () => {
    expect(splitMoney("2 223 014 Ft")).toEqual({ value: "2 223 014", unit: "Ft" });
    expect(splitMoney("0 Ft")).toEqual({ value: "0", unit: "Ft" });
  });

  it("keeps a prefix symbol with the number", () => {
    expect(splitMoney("€825.50")).toEqual({ value: "€825.50", unit: "" });
  });

  it("splits an ISO code suffix", () => {
    expect(splitMoney("1,234.50 CHF")).toEqual({ value: "1,234.50", unit: "CHF" });
  });
});
