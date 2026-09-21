// components/invoices/NavExchangeRateAuditCard.test.tsx
// AC5.1, 5.2, 5.4, 5.6 — purely presentational, renders only for
// kind: "misreported", branches on currentRate === null.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { NavExchangeRateAuditCard } from "@/components/invoices/NavExchangeRateAuditCard";

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

const mockUi = require("@/__tests__/mocks/gluestack-ui");

function render(props: Partial<React.ComponentProps<typeof NavExchangeRateAuditCard>> = {}) {
  const defaults: React.ComponentProps<typeof NavExchangeRateAuditCard> = {
    report: { kind: "none" },
    currency: "EUR",
    onIssueCorrection: jest.fn(),
    onAddRate: jest.fn(),
  };
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<NavExchangeRateAuditCard {...defaults} {...props} />);
  });
  return tree!;
}

describe("NavExchangeRateAuditCard", () => {
  it("5.1 — renders nothing for kind: none", () => {
    const tree = render({ report: { kind: "none" } });
    expect(tree.toJSON()).toBeNull();
  });

  it("5.1 — renders nothing for kind: ok", () => {
    const tree = render({ report: { kind: "ok" } });
    expect(tree.toJSON()).toBeNull();
  });

  it("5.1 — renders nothing for kind: unknown", () => {
    const tree = render({ report: { kind: "unknown" } });
    expect(tree.toJSON()).toBeNull();
  });

  it("5.2 — misreported with amounts: renders reported/current rate and reported/correct HUF VAT", () => {
    const tree = render({
      report: {
        kind: "misreported",
        reportedRate: 1,
        currentRate: 400,
        source: "recorded",
        reportedVatHuf: 27,
        correctVatHuf: 10800,
        deltaVatHuf: 10773,
        reportedNetHuf: 100,
        correctNetHuf: 40000,
        deltaNetHuf: 39900,
        reportedGrossHuf: 127,
        correctGrossHuf: 50800,
        deltaGrossHuf: 50673,
      },
      currency: "EUR",
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.navExchangeRateAudit.title");
    expect(json).toContain("invoices.navExchangeRateAudit.body");
    // Rate/amount values, formatted, appear somewhere in the render.
    expect(json).toContain("27");
    expect(json).toContain("10");
    expect(json).toContain("800");
  });

  it("5.2 — issue-correction button fires onIssueCorrection when amounts are known", () => {
    const onIssueCorrection = jest.fn();
    const onAddRate = jest.fn();
    const tree = render({
      report: {
        kind: "misreported",
        reportedRate: 1,
        currentRate: 400,
        source: "recorded",
        reportedVatHuf: 27,
        correctVatHuf: 10800,
        deltaVatHuf: 10773,
        reportedNetHuf: 100,
        correctNetHuf: 40000,
        deltaNetHuf: 39900,
        reportedGrossHuf: 127,
        correctGrossHuf: 50800,
        deltaGrossHuf: 50673,
      },
      onIssueCorrection,
      onAddRate,
    });

    const button = tree.root.findByProps({ testID: "nav-exchange-rate-audit-primary-action" });
    act(() => {
      button.props.onPress?.();
    });
    expect(onIssueCorrection).toHaveBeenCalledTimes(1);
    expect(onAddRate).not.toHaveBeenCalled();
  });

  it("5.4 — missing currentRate: renders the add-rate body and routes to onAddRate, not onIssueCorrection", () => {
    const onIssueCorrection = jest.fn();
    const onAddRate = jest.fn();
    const tree = render({
      report: { kind: "misreported", reportedRate: 1, currentRate: null, source: "legacyImplicitOne" },
      currency: "EUR",
      onIssueCorrection,
      onAddRate,
    });

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.navExchangeRateAudit.missingRateBody");
    expect(json).not.toContain("invoices.navExchangeRateAudit.body:");

    const button = tree.root.findByProps({ testID: "nav-exchange-rate-audit-primary-action" });
    act(() => {
      button.props.onPress?.();
    });
    expect(onAddRate).toHaveBeenCalledTimes(1);
    expect(onIssueCorrection).not.toHaveBeenCalled();
  });

  it("5.6 — no hardcoded user-facing text — every Text node's content is an i18n key path", () => {
    const tree = render({
      report: {
        kind: "misreported",
        reportedRate: 1,
        currentRate: 400,
        source: "legacyImplicitOne",
        reportedVatHuf: 27,
        correctVatHuf: 10800,
        deltaVatHuf: 10773,
        reportedNetHuf: 100,
        correctNetHuf: 40000,
        deltaNetHuf: 39900,
        reportedGrossHuf: 127,
        correctGrossHuf: 50800,
        deltaGrossHuf: 50673,
      },
    });
    const textNodes = tree.root.findAllByType(mockUi.Text);
    const contents = textNodes.flatMap((node) => {
      const c = node.props.children;
      return Array.isArray(c) ? c : [c];
    });
    let sawI18nKey = false;
    for (const content of contents) {
      if (typeof content !== "string") continue;
      if (content.startsWith("invoices.navExchangeRateAudit.")) {
        sawI18nKey = true;
        continue;
      }
      // Formatted numbers (rate/HUF amounts) are allowed as raw leaf text —
      // only unstructured hardcoded prose would fail this.
      expect(/^[\d.,\s€FtHUF-]*$/.test(content)).toBe(true);
    }
    expect(sawI18nKey).toBe(true);
  });

  it("busy disables the primary action", () => {
    const tree = render({
      report: {
        kind: "misreported",
        reportedRate: 1,
        currentRate: 400,
        source: "recorded",
        reportedVatHuf: 27,
        correctVatHuf: 10800,
        deltaVatHuf: 10773,
        reportedNetHuf: 100,
        correctNetHuf: 40000,
        deltaNetHuf: 39900,
        reportedGrossHuf: 127,
        correctGrossHuf: 50800,
        deltaGrossHuf: 50673,
      },
      busy: true,
    });
    const button = tree.root.findByProps({ testID: "nav-exchange-rate-audit-primary-action" });
    expect(button.props.disabled).toBe(true);
  });
});
