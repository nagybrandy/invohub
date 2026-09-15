// components/invoices/composer/ComposerSummary.test.tsx
// The sticky desktop summary: always-visible live Nettó/ÁFA/Bruttó with a
// VAT row (INV-13), and a "Teljes előnézet" action that opens the full
// preview WITHOUT replacing the form (INV-9) — it's a modal, not a swap.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { ComposerSummary } from "@/components/invoices/composer/ComposerSummary";
import { makeInvoice, makeLineItem } from "@/__tests__/fixtures/invoices";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/card", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/heading", () => ({ Heading: require("@/__tests__/mocks/gluestack-ui").Text }));
jest.mock("@/components/ui/button", () => ({
  Button: require("@/__tests__/mocks/gluestack-ui").Pressable,
  ButtonText: require("@/__tests__/mocks/gluestack-ui").Text,
}));
jest.mock("@/components/ui/drawer", () => {
  const { View } = require("react-native");
  return {
    Drawer: ({ isOpen, children }: { isOpen: boolean; children?: React.ReactNode }) =>
      isOpen ? <View testID="drawer-open">{children}</View> : null,
    DrawerBackdrop: View,
    DrawerContent: View,
    DrawerHeader: View,
    DrawerBody: View,
  };
});
jest.mock("@/components/invoices/InvoiceDocumentPreview", () => ({
  InvoiceDocumentPreview: () => null,
}));

const t = (key: string, opts?: Record<string, unknown>) =>
  opts ? `${key}:${JSON.stringify(opts)}` : key;

function render(overrides: Partial<React.ComponentProps<typeof ComposerSummary>> = {}) {
  const lineItems = overrides.lineItems ?? [
    makeLineItem({ description: "Tanácsadás", quantity: 1, unitPrice: 450000, vatRate: 27 }),
  ];
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ComposerSummary
        invoice={overrides.invoice ?? makeInvoice({ lineItems })}
        totals={overrides.totals ?? { subtotal: 450000, vatTotal: 121500, totalAmount: 571500 }}
        currency={overrides.currency ?? "HUF"}
        lineItems={lineItems}
        t={t}
      />
    );
  });
  return tree!;
}

function findPressableWithText(root: TestRenderer.ReactTestInstance, text: string) {
  return root
    .findAll((node) => typeof node.props?.onPress === "function")
    .find((node) => node.findAll((child) => child.props?.children === text).length > 0);
}

describe("ComposerSummary", () => {
  it("shows Nettó / ÁFA / Bruttó with a VAT row, not just two numbers (INV-13)", () => {
    const tree = render();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.totals.netTotal");
    expect(json).toContain("invoices.composer.vatRowLabel");
    expect(json).toContain("invoices.totals.grossTotal");
    expect(json).toContain("450,000");
    expect(json).toContain("121,500");
    expect(json).toContain("571,500");
  });

  it("shows a neutral VAT placeholder row when there are no line items yet", () => {
    const tree = render({
      lineItems: [],
      totals: { subtotal: 0, vatTotal: 0, totalAmount: 0 },
    });
    expect(JSON.stringify(tree.toJSON())).toContain("invoices.composer.vatRowEmpty");
  });

  it("opens the full preview in a modal, not by replacing this summary (INV-9)", () => {
    const tree = render();
    expect(tree.root.findAllByProps({ testID: "drawer-open" })).toHaveLength(0);

    const openPreview = findPressableWithText(tree.root, "invoices.composer.openFullPreview");
    act(() => {
      openPreview?.props.onPress?.();
    });

    // The summary card (still showing the totals) and the preview modal
    // both exist at once — the preview never swaps out the summary.
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.totals.grossTotal");
    expect(tree.root.findAllByProps({ testID: "drawer-open" }).length).toBeGreaterThan(0);
  });
});
