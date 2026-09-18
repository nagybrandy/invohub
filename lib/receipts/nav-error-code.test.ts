// lib/receipts/nav-error-code.test.ts
import {
  NAV_RECEIPT_BLOCKED_REASONS,
  isNavReceiptBlockedReason,
  navReceiptErrorI18nKey,
} from "@/lib/receipts/nav-error-code";

describe("NAV_RECEIPT_BLOCKED_REASONS", () => {
  it("contains exactly the known blocked-reason codes", () => {
    expect(NAV_RECEIPT_BLOCKED_REASONS).toEqual(["missing_exchange_rate"]);
  });
});

describe("isNavReceiptBlockedReason", () => {
  it("returns true for a known blocked-reason code", () => {
    expect(isNavReceiptBlockedReason("missing_exchange_rate")).toBe(true);
  });

  it("returns false for NAV's own error text", () => {
    expect(isNavReceiptBlockedReason("VALIDATION_ERROR Bad data")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isNavReceiptBlockedReason("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isNavReceiptBlockedReason(null)).toBe(false);
  });
});

describe("navReceiptErrorI18nKey", () => {
  it("maps a known blocked-reason code to its i18n key", () => {
    expect(navReceiptErrorI18nKey("missing_exchange_rate")).toBe(
      "receipts.navMissingExchangeRate"
    );
  });

  it("returns null for NAV's own (untranslatable) error text", () => {
    expect(navReceiptErrorI18nKey("VALIDATION_ERROR Bad data")).toBeNull();
  });

  it("returns null for null", () => {
    expect(navReceiptErrorI18nKey(null)).toBeNull();
  });
});
