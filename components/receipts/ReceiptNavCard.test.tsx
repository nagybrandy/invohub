// components/receipts/ReceiptNavCard.test.tsx
import * as React from "react";
import TestRenderer from "react-test-renderer";
import { ReceiptNavCard } from "@/components/receipts/ReceiptNavCard";

// Key-passthrough t, same pattern as components/invoices/NavStatusCard.test.tsx:
// with no `defaultValue` it renders the raw key, so a translated key shows up
// verbatim in the tree and an untranslated fallback string does not.
const mockT = jest.fn((key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key);

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockT }),
}));

jest.mock("@/components/ui/badge", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/card", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

function render(props: React.ComponentProps<typeof ReceiptNavCard>) {
  let tree: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    tree = TestRenderer.create(<ReceiptNavCard {...props} />);
  });
  return tree!;
}

const baseProps = {
  navSubmitted: false,
  navMode: "demo" as const,
  navReportId: null,
  navError: null,
  currency: "EUR",
};

describe("ReceiptNavCard", () => {
  beforeEach(() => {
    mockT.mockClear();
  });

  it("renders the translated, currency-interpolated message for a known blocked-reason code (AC4.1, AC4.3)", () => {
    const tree = render({ ...baseProps, navError: "missing_exchange_rate" });
    const json = JSON.stringify(tree.toJSON());

    // The key itself shows up (passthrough mock), never the bare raw code.
    expect(json).toContain("receipts.navMissingExchangeRate");
    expect(json).not.toContain(">missing_exchange_rate<");

    expect(mockT).toHaveBeenCalledWith("receipts.navMissingExchangeRate", { currency: "EUR" });
  });

  it("renders NAV's own error text unchanged, with no receipts.navMissingExchangeRate key leaking into the UI (AC4.2)", () => {
    const tree = render({ ...baseProps, navError: "VALIDATION_ERROR Bad data" });
    const json = JSON.stringify(tree.toJSON());

    expect(json).toContain("VALIDATION_ERROR Bad data");
    expect(json).not.toContain("receipts.navMissingExchangeRate");
    expect(mockT).not.toHaveBeenCalledWith("receipts.navMissingExchangeRate", expect.anything());
  });

  it("renders no error block at all when navError is null", () => {
    const tree = render({ ...baseProps, navError: null });
    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain("receipts.navReportError");
  });
});
