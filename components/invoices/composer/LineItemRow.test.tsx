// components/invoices/composer/LineItemRow.test.tsx
// The desktop grid row after the merge (composer-line-item-horizontal-
// scroll-1440): exactly 6 cells whose widths come from COMPOSER_GRID_COLUMNS
// (AC6), the merged qty/unit cell keeps the unit picker wired through
// onChange (AC7, INV-6), the merged amount cell still shows both bruttó and
// nettó (AC8), the mobile card is untouched (AC11), and tap targets don't
// shrink (AC12). VatCategoryPicker has its own coverage
// (VatCategoryPicker.test.tsx) — stubbed here.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { LineItemRow } from "@/components/invoices/composer/LineItemRow";
import { COMPOSER_GRID_COLUMNS } from "@/components/invoices/composer/grid-columns";
import { makeLineItem } from "@/__tests__/fixtures/invoices";
import { confirmAsync } from "@/lib/ui/confirm";
import type { Product } from "@/lib/products/service";

jest.mock("@/lib/ui/confirm", () => ({
  confirmAsync: jest.fn(),
}));
const mockConfirmAsync = confirmAsync as jest.MockedFunction<typeof confirmAsync>;

jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", primary: "#4f46e5" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/input", () => {
  const { TextInput } = require("react-native");
  return {
    Input: ({ children }: { children?: React.ReactNode }) => children ?? null,
    InputField: (props: Record<string, unknown>) => <TextInput {...props} />,
  };
});
jest.mock("@/components/invoices/composer/VatCategoryPicker", () => ({
  VatCategoryPicker: () => null,
}));

const t = (key: string, opts?: Record<string, unknown>) =>
  opts ? `${key}:${JSON.stringify(opts)}` : key;

const PRODUCTS: Product[] = [];

function render(overrides: Partial<React.ComponentProps<typeof LineItemRow>> = {}) {
  const onChange = jest.fn();
  const onRemove = jest.fn();
  const onFillFromProduct = jest.fn();
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <LineItemRow
        index={overrides.index ?? 0}
        item={overrides.item ?? makeLineItem({ description: "Tanácsadás", quantity: 1, unitPrice: 450000, vatRate: 27 })}
        currency={overrides.currency ?? "HUF"}
        products={overrides.products ?? PRODUCTS}
        canDelete={overrides.canDelete ?? true}
        onChange={onChange}
        onRemove={onRemove}
        onFillFromProduct={onFillFromProduct}
        t={t}
      />
    );
  });
  return { tree: tree!, onChange, onRemove, onFillFromProduct };
}

function findByText(root: TestRenderer.ReactTestInstance, text: string) {
  return root.findAll((node) => node.props?.children === text);
}

function findPressableWithText(root: TestRenderer.ReactTestInstance, text: string) {
  return root
    .findAll((node) => typeof node.props?.onPress === "function")
    .find((node) => node.findAll((child) => child.props?.children === text).length > 0);
}

function findPressableWithA11yLabel(root: TestRenderer.ReactTestInstance, label: string) {
  return root.findAll((node) => node.props?.accessibilityLabel === label && typeof node.props?.onPress === "function");
}

describe("LineItemRow — desktop grid (composer-line-item-horizontal-scroll-1440)", () => {
  beforeEach(() => {
    mockConfirmAsync.mockReset();
  });

  it("renders exactly 6 desktop cells, one per COMPOSER_GRID_COLUMNS entry (AC6)", () => {
    const { tree } = render();
    // The desktop branch is the (mocked-to-View) HStack with items-start
    // that holds one direct cell child per grid column (mirrors
    // StepLineItems' header). The mock renders a composite AND a host node
    // with the same className — pick whichever actually has the fan-out of
    // children, host or composite.
    const candidates = tree.root.findAll(
      (node) =>
        typeof node.props?.className === "string" &&
        node.props.className.includes("hidden") &&
        node.props.className.includes("md:flex")
    );
    const desktopRow = candidates.find((n) => Array.isArray(n.children) && n.children.length > 1);
    expect(desktopRow).toBeTruthy();
    expect(desktopRow!.children).toHaveLength(COMPOSER_GRID_COLUMNS.length);
  });

  it("renders the quantity InputField plus a unit control labeled invoices.fields.unit (AC7, INV-6)", () => {
    const { tree, onChange } = render();
    const unitControl = findPressableWithA11yLabel(tree.root, "invoices.fields.unit")[0];
    expect(unitControl).toBeTruthy();

    act(() => {
      unitControl.props.onPress?.();
    });
    const unitOption = findPressableWithText(tree.root, "óra");
    expect(unitOption).toBeTruthy();
    act(() => {
      unitOption?.props.onPress?.();
    });
    expect(onChange).toHaveBeenCalledWith({ unit: "óra" });
  });

  it("shows both the bruttó and nettó figures in the merged amount cell, no figure disappears (AC8)", () => {
    const { tree } = render({
      item: makeLineItem({ description: "Tanácsadás", quantity: 1, unitPrice: 450000, vatRate: 27, vatCategory: "normal" }),
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("571,500");
    expect(json).toContain("450,000");
    expect(json).toContain("invoices.lineItemEditor.netAbbrev");

    const grossNode = findByText(tree.root, "571,500 Ft").find(
      (node) => typeof node.props?.className === "string" && node.props.className.includes("font-semibold")
    );
    expect(grossNode).toBeTruthy();

    const netLine = tree.root.findAll(
      (node) =>
        typeof node.props?.className === "string" &&
        node.props.className.includes("text-muted-foreground") &&
        Array.isArray(node.props?.children) &&
        JSON.stringify(node.props.children).includes("450,000")
    );
    expect(netLine.length).toBeGreaterThan(0);
  });

  it("keeps the unit control and delete control at h-9 with hitSlop 8 (>=44px effective) (AC12)", () => {
    const { tree } = render();
    const unitControl = findPressableWithA11yLabel(tree.root, "invoices.fields.unit")[0];
    expect(unitControl.props.hitSlop).toBe(8);
    expect(String(unitControl.props.className)).toContain("h-9");

    const deleteControls = findPressableWithA11yLabel(tree.root, "invoices.lineItemEditor.deleteAction");
    const desktopDelete = deleteControls.find((n) => String(n.props.className).includes("h-9"));
    expect(desktopDelete).toBeTruthy();
    expect(desktopDelete!.props.hitSlop).toBe(8);
  });

  it("does not delete without confirmation when the description is filled, and calls onRemove once confirmed", async () => {
    mockConfirmAsync.mockResolvedValue(true);
    const { tree, onRemove } = render({
      item: makeLineItem({ description: "Tanácsadás" }),
    });
    const desktopDelete = findPressableWithA11yLabel(tree.root, "invoices.lineItemEditor.deleteAction").find((n) =>
      String(n.props.className).includes("h-9")
    );
    await act(async () => {
      await desktopDelete!.props.onPress?.();
    });
    expect(mockConfirmAsync).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalled();
  });
});

describe("LineItemRow — mobile card is unchanged (AC11)", () => {
  it("still renders the lineLabel header, description, 2x2 field grid and lineTotal", () => {
    const { tree } = render({ index: 2 });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.lineItemEditor.lineLabel");
    expect(json).toContain("\\\"index\\\":3");
    expect(json).toContain("invoices.lineItemEditor.descriptionPlaceholder");
    expect(json).toContain("invoices.lineItemEditor.quantity");
    expect(json).toContain("invoices.fields.unit");
    expect(json).toContain("invoices.lineItemEditor.unitPrice");
    expect(json).toContain("invoices.vat.categoryLabel");
    expect(json).toContain("invoices.lineItemEditor.lineTotal");
  });

  it("keeps a 44px mobile delete target (h-11 w-11)", () => {
    const { tree } = render();
    const mobileDelete = findPressableWithA11yLabel(tree.root, "invoices.lineItemEditor.deleteAction").find((n) =>
      String(n.props.className).includes("h-11")
    );
    expect(mobileDelete).toBeTruthy();
    expect(String(mobileDelete!.props.className)).toContain("w-11");
  });
});
