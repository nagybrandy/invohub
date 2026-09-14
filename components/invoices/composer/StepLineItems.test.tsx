// components/invoices/composer/StepLineItems.test.tsx
// Step 2's grid: the Egység (unit) column exists (INV-6), the VAT row is
// never dropped from the live summary (INV-13), and picking a catalogue
// product wires through onAddFromProduct (INV-5).
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StepLineItems } from "@/components/invoices/composer/StepLineItems";
import { makeLineItem } from "@/__tests__/fixtures/invoices";
import type { Product } from "@/lib/products/service";

jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

// LineItemRow has its own dependency graph (VatCategoryPicker, confirmAsync,
// icon colors) already covered by VatCategoryPicker.test.tsx — stub it here
// so this file stays focused on StepLineItems' own header/totals/catalog
// wiring, not a second copy of that coverage.
jest.mock("@/components/invoices/composer/LineItemRow", () => ({
  LineItemRow: ({ item }: { item: { id: string; description: string } }) => {
    const { Text } = require("react-native");
    return <Text testID={`row-${item.id}`}>{item.description}</Text>;
  },
}));

const t = (key: string, opts?: Record<string, unknown>) =>
  opts ? `${key}:${JSON.stringify(opts)}` : key;

const PRODUCT: Product = {
  id: "prod-1",
  userId: "u1",
  name: "Consulting day",
  unit: "day",
  unitPrice: 350,
  vatRate: 27,
  createdAt: "",
  updatedAt: "",
};

function render(overrides: Partial<React.ComponentProps<typeof StepLineItems>> = {}) {
  const onUpdate = jest.fn();
  const onAdd = jest.fn();
  const onAddFromProduct = jest.fn();
  const onRemove = jest.fn();
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <StepLineItems
        lineItems={overrides.lineItems ?? [makeLineItem({ description: "Tanácsadás", quantity: 1, unitPrice: 450000 })]}
        currency={overrides.currency ?? "HUF"}
        products={overrides.products ?? [PRODUCT]}
        onUpdate={onUpdate}
        onAdd={onAdd}
        onAddFromProduct={onAddFromProduct}
        onRemove={onRemove}
        t={t}
      />
    );
  });
  return { tree: tree!, onUpdate, onAdd, onAddFromProduct, onRemove };
}

function findPressableWithText(root: TestRenderer.ReactTestInstance, text: string) {
  return root
    .findAll((node) => typeof node.props?.onPress === "function")
    .find((node) => node.findAll((child) => child.props?.children === text).length > 0);
}

describe("StepLineItems", () => {
  it("shows the Egység (unit) column header (INV-6)", () => {
    const { tree } = render();
    expect(JSON.stringify(tree.toJSON())).toContain("invoices.fields.unit");
  });

  it("computes a live VAT row alongside Nettó/Bruttó — never just two numbers (INV-13)", () => {
    const { tree } = render({
      lineItems: [makeLineItem({ description: "Tanácsadás", quantity: 1, unitPrice: 450000, vatRate: 27 })],
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.totals.netTotal");
    expect(json).toContain("invoices.composer.vatRowLabel");
    expect(json).toContain("27%");
    expect(json).toContain("invoices.totals.grossTotal");
  });

  it("recomputes totals live as line items change", () => {
    const items = [makeLineItem({ description: "Tanácsadás", quantity: 1, unitPrice: 100000, vatRate: 27 })];
    const { tree } = render({ lineItems: items, currency: "HUF" });
    expect(JSON.stringify(tree.toJSON())).toContain("127,000");

    act(() => {
      tree.update(
        <StepLineItems
          lineItems={[makeLineItem({ description: "Tanácsadás", quantity: 1, unitPrice: 450000, vatRate: 27 })]}
          currency="HUF"
          products={[PRODUCT]}
          onUpdate={jest.fn()}
          onAdd={jest.fn()}
          onAddFromProduct={jest.fn()}
          onRemove={jest.fn()}
          t={t}
        />
      );
    });
    expect(JSON.stringify(tree.toJSON())).toContain("571,500");
  });

  it("opens the catalogue and wires a pick through onAddFromProduct (INV-5)", () => {
    const { tree, onAddFromProduct } = render();
    const catalogToggle = findPressableWithText(tree.root, "invoices.composer.addFromCatalog");
    act(() => {
      catalogToggle?.props.onPress?.();
    });
    const productOption = findPressableWithText(tree.root, "Consulting day");
    expect(productOption).toBeTruthy();
    act(() => {
      productOption?.props.onPress?.();
    });
    expect(onAddFromProduct).toHaveBeenCalledWith(PRODUCT);
  });

  it("renders one row per line item", () => {
    const { tree } = render({
      lineItems: [
        makeLineItem({ id: "a", description: "First" }),
        makeLineItem({ id: "b", description: "Second" }),
      ],
    });
    expect(tree.root.findByProps({ testID: "row-a" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "row-b" })).toBeTruthy();
  });
});
