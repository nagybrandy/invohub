// components/invoices/ExchangeRateFixBanner.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { ExchangeRateFixBanner } from "@/components/invoices/ExchangeRateFixBanner";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/card", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => {
  const mockUi = require("@/__tests__/mocks/gluestack-ui");
  return { Button: mockUi.Pressable, ButtonText: mockUi.Text };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

describe("ExchangeRateFixBanner", () => {
  it("renders nothing when count is 0 and not active (AC4.1)", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ExchangeRateFixBanner
          count={0}
          active={false}
          onShowAffected={jest.fn()}
          onShowAll={jest.fn()}
        />
      );
    });
    expect(tree!.toJSON()).toBeNull();
  });

  it("renders the interpolated count and an action when count > 0 (AC4.2)", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ExchangeRateFixBanner
          count={3}
          active={false}
          onShowAffected={jest.fn()}
          onShowAll={jest.fn()}
        />
      );
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('invoices.exchangeRateFix.banner:{\\"count\\":3}');
    expect(json).toContain("invoices.exchangeRateFix.showAffected");
  });

  it("renders no hardcoded user-facing text — every string goes through t() (AC4.5)", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ExchangeRateFixBanner
          count={2}
          active={false}
          onShowAffected={jest.fn()}
          onShowAll={jest.fn()}
        />
      );
    });
    const mockUi = require("@/__tests__/mocks/gluestack-ui");
    // Every rendered Text node's content must be an i18n key path (the
    // mocked t() returns the key itself, or "key:{...}" when interpolated)
    // — never plain English/Hungarian prose baked into the component.
    const textNodes = tree!.root.findAllByType(mockUi.Text);
    const contents = textNodes.flatMap((node) => {
      const c = node.props.children;
      return Array.isArray(c) ? c : [c];
    });
    for (const content of contents) {
      if (typeof content !== "string") continue;
      expect(content.startsWith("invoices.exchangeRateFix.")).toBe(true);
    }
    expect(contents.length).toBeGreaterThan(0);
  });

  it("fires onShowAffected when inactive and pressed", () => {
    const onShowAffected = jest.fn();
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ExchangeRateFixBanner
          count={3}
          active={false}
          onShowAffected={onShowAffected}
          onShowAll={jest.fn()}
        />
      );
    });
    const button = tree!.root.findByProps({ testID: "exchange-rate-fix-banner-action" });
    act(() => {
      button.props.onPress?.();
    });
    expect(onShowAffected).toHaveBeenCalledTimes(1);
  });

  it("fires onShowAll and shows the 'show all' label when active", () => {
    const onShowAll = jest.fn();
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ExchangeRateFixBanner
          count={3}
          active={true}
          onShowAffected={jest.fn()}
          onShowAll={onShowAll}
        />
      );
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain("invoices.exchangeRateFix.showAll");

    const button = tree!.root.findByProps({ testID: "exchange-rate-fix-banner-action" });
    act(() => {
      button.props.onPress?.();
    });
    expect(onShowAll).toHaveBeenCalledTimes(1);
  });

  it("still renders when active even if count is 0 (already in the affected-only view)", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ExchangeRateFixBanner
          count={0}
          active={true}
          onShowAffected={jest.fn()}
          onShowAll={jest.fn()}
        />
      );
    });
    expect(tree!.toJSON()).not.toBeNull();
  });
});
