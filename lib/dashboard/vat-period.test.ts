// lib/dashboard/vat-period.test.ts
import { formatVatPeriodLabel } from "@/lib/dashboard/vat-period";

describe("formatVatPeriodLabel", () => {
  it("renders a Hungarian roman-numeral quarter label", () => {
    expect(formatVatPeriodLabel(new Date("2026-08-01"), "hu")).toBe("2026. III. negyedév");
  });

  it("renders an English quarter label", () => {
    expect(formatVatPeriodLabel(new Date("2026-01-15"), "en")).toBe("Q1 2026");
  });

  it("handles each quarter boundary", () => {
    expect(formatVatPeriodLabel(new Date("2026-01-01"), "hu")).toBe("2026. I. negyedév");
    expect(formatVatPeriodLabel(new Date("2026-04-01"), "hu")).toBe("2026. II. negyedév");
    expect(formatVatPeriodLabel(new Date("2026-10-01"), "hu")).toBe("2026. IV. negyedév");
  });
});
