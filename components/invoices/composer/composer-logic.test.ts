// components/invoices/composer/composer-logic.test.ts
import { makeLineItem } from "@/__tests__/fixtures/invoices";
import {
  canEnableEmailOnSend,
  composerDesktopLayout,
  groupVatRows,
  resolveStatusForAction,
  shouldSendOnAction,
  validateBuyerAddressStep,
  validateDueDate,
  validateExchangeRateInput,
  validateLineItemsStep,
  validatePartnerStep,
} from "@/components/invoices/composer/composer-logic";

describe("resolveStatusForAction (INV-15)", () => {
  it("draft always saves as draft", () => {
    expect(resolveStatusForAction("draft", "invoice")).toBe("draft");
  });

  it("finalize saves as unpaid, never sent", () => {
    expect(resolveStatusForAction("finalize", "invoice")).toBe("unpaid");
  });

  it("finalizeAndSend saves as sent", () => {
    expect(resolveStatusForAction("finalizeAndSend", "invoice")).toBe("sent");
  });

  it("a proforma document type always saves as proforma regardless of the action", () => {
    expect(resolveStatusForAction("draft", "proforma")).toBe("proforma");
    expect(resolveStatusForAction("finalize", "proforma")).toBe("proforma");
    expect(resolveStatusForAction("finalizeAndSend", "proforma")).toBe("proforma");
  });
});

describe("shouldSendOnAction (INV-2, INV-15)", () => {
  it("only finalizeAndSend triggers a send", () => {
    expect(shouldSendOnAction("draft")).toBe(false);
    expect(shouldSendOnAction("finalize")).toBe(false);
    expect(shouldSendOnAction("finalizeAndSend")).toBe(true);
  });
});

describe("validatePartnerStep (INV-4)", () => {
  it("rejects an empty partner name", () => {
    expect(validatePartnerStep("   ")).toEqual({
      valid: false,
      errorKey: "invoices.errors.clientRequired",
      focusField: "clientName",
    });
  });

  it("accepts a non-empty partner name", () => {
    expect(validatePartnerStep("Tech Solutions Kft.")).toEqual({ valid: true });
  });
});

describe("validateBuyerAddressStep (Áfa tv. 169. § e)", () => {
  const complete = { clientZip: "1011", clientCity: "Budapest", clientAddress: "Fő utca 1." };

  it("accepts when zip, city and address are all filled in", () => {
    expect(validateBuyerAddressStep(complete)).toEqual({ valid: true });
  });

  it("rejects a missing zip code, focusing clientZip", () => {
    expect(validateBuyerAddressStep({ ...complete, clientZip: "" })).toEqual({
      valid: false,
      errorKey: "invoices.errors.buyerAddressRequired",
      focusField: "clientZip",
    });
  });

  it("rejects a missing city", () => {
    expect(validateBuyerAddressStep({ ...complete, clientCity: "  " }).valid).toBe(false);
  });

  it("rejects a missing street address", () => {
    expect(validateBuyerAddressStep({ ...complete, clientAddress: "" }).valid).toBe(false);
  });
});

describe("validateLineItemsStep (INV-4)", () => {
  it("rejects when no line item has a description", () => {
    const result = validateLineItemsStep([makeLineItem({ description: "" })]);
    expect(result.valid).toBe(false);
    expect(result.errorKey).toBe("invoices.errors.lineItemRequired");
  });

  it("accepts when at least one line item has a description", () => {
    const result = validateLineItemsStep([
      makeLineItem({ description: "" }),
      makeLineItem({ description: "Tanácsadás" }),
    ]);
    expect(result.valid).toBe(true);
  });
});

describe("validateDueDate (INV-8)", () => {
  it("rejects a due date before the issue date", () => {
    const result = validateDueDate("2026-09-20", "2026-09-10");
    expect(result.valid).toBe(false);
    expect(result.errorKey).toBe("invoices.errors.dueBeforeIssue");
  });

  it("accepts a due date equal to the issue date", () => {
    expect(validateDueDate("2026-09-20", "2026-09-20").valid).toBe(true);
  });

  it("accepts a due date after the issue date", () => {
    expect(validateDueDate("2026-09-20", "2026-09-28").valid).toBe(true);
  });
});

describe("validateExchangeRateInput (AC12)", () => {
  it("rejects a blank rate for a non-HUF currency as required", () => {
    const result = validateExchangeRateInput("", "EUR");
    expect(result.valid).toBe(false);
    expect(result.errorKey).toBe("invoices.errors.exchangeRateRequired");
  });

  it("rejects a zero rate for a non-HUF currency as invalid", () => {
    const result = validateExchangeRateInput("0", "EUR");
    expect(result.valid).toBe(false);
    expect(result.errorKey).toBe("invoices.errors.exchangeRateInvalid");
  });

  it("accepts a comma-decimal rate for a non-HUF currency", () => {
    expect(validateExchangeRateInput("390,5", "EUR").valid).toBe(true);
  });

  it("never requires a rate for HUF, blank or not", () => {
    expect(validateExchangeRateInput("", "HUF").valid).toBe(true);
    expect(validateExchangeRateInput("0", "HUF").valid).toBe(true);
  });
});

describe("canEnableEmailOnSend (INV-2)", () => {
  it("is false without an e-mail", () => {
    expect(canEnableEmailOnSend("")).toBe(false);
    expect(canEnableEmailOnSend("   ")).toBe(false);
  });

  it("is true with an e-mail", () => {
    expect(canEnableEmailOnSend("partner@ceg.hu")).toBe(true);
  });
});

describe("composerDesktopLayout (composer-line-item-horizontal-scroll-1440)", () => {
  it("gives the items step the full content width — no summary column, no form cap", () => {
    expect(composerDesktopLayout("items")).toEqual({
      showSummaryColumn: false,
      formMaxWidth: undefined,
    });
  });

  it("keeps the 400px sticky summary and 720px form cap on partner", () => {
    expect(composerDesktopLayout("partner")).toEqual({
      showSummaryColumn: true,
      formMaxWidth: 720,
    });
  });

  it("keeps the 400px sticky summary and 720px form cap on review", () => {
    expect(composerDesktopLayout("review")).toEqual({
      showSummaryColumn: true,
      formMaxWidth: 720,
    });
  });
});

describe("groupVatRows (INV-13)", () => {
  it("groups taxed line items by rate", () => {
    const rows = groupVatRows([
      makeLineItem({ description: "A", quantity: 1, unitPrice: 1000, vatRate: 27, vatCategory: "normal" }),
      makeLineItem({ description: "B", quantity: 1, unitPrice: 1000, vatRate: 27, vatCategory: "normal" }),
    ]);
    expect(rows).toEqual([{ key: "normal-27", label: "27%", net: 2000, vat: 540 }]);
  });

  it("keeps different rates and exempt categories on separate rows", () => {
    const rows = groupVatRows([
      makeLineItem({ description: "A", quantity: 1, unitPrice: 1000, vatRate: 27, vatCategory: "normal" }),
      makeLineItem({ description: "B", quantity: 1, unitPrice: 500, vatRate: 0, vatCategory: "AAM" }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.key === "normal-27")).toEqual({ key: "normal-27", label: "27%", net: 1000, vat: 270 });
    expect(rows.find((r) => r.key === "AAM")).toEqual({ key: "AAM", label: "AAM", net: 500, vat: 0 });
  });

  it("ignores blank line items", () => {
    expect(groupVatRows([makeLineItem({ description: "" })])).toEqual([]);
  });
});
