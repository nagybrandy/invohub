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
        layout={overrides.layout ?? "grid"}
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
    const candidates = tree.root.findAll((node) => node.props?.testID === "lineItem-0-grid-row");
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

  it("anchors the open unit-picker menu at top-11, matching the 44px row it sits under (fixround1 finding, exchange-rate-input-tap-target-mobile)", () => {
    const { tree } = render();
    const unitControl = findPressableWithA11yLabel(tree.root, "invoices.fields.unit")[0];

    act(() => {
      unitControl.props.onPress?.();
    });

    const menu = tree.root.findAll(
      (node) => typeof node.props?.className === "string" && node.props.className.includes("absolute")
    );
    expect(menu.length).toBeGreaterThan(0);
    for (const node of menu) {
      expect(String(node.props.className)).toContain("top-11");
      expect(String(node.props.className)).not.toContain("top-9");
    }
  });

  it("anchors the description-autocomplete dropdown at top-11, matching the 44px row it sits under (fixround2 finding, exchange-rate-input-tap-target-mobile)", () => {
    const products: Product[] = [
      {
        id: "p1",
        userId: "u1",
        name: "Tanácsadás óra",
        unitPrice: 15000,
        unit: "óra",
        vatRate: 27,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const { tree } = render({
      item: makeLineItem({ description: "Tan", quantity: 1, unitPrice: 450000, vatRate: 27 }),
      products,
    });

    const descriptionField = tree.root.findByProps({ testID: "lineItem-0-description" });
    act(() => {
      descriptionField.props.onFocus?.();
    });

    const menu = tree.root.findAll(
      (node) => typeof node.props?.className === "string" && node.props.className.includes("absolute")
    );
    expect(menu.length).toBeGreaterThan(0);
    for (const node of menu) {
      expect(String(node.props.className)).toContain("top-11");
      expect(String(node.props.className)).not.toContain("top-9");
    }
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

  it("matches the unit control to the quantity input's height (h-11), keeps the delete control at h-9 with hitSlop 8 (AC12, exchange-rate-input-tap-target-mobile)", () => {
    const { tree } = render();
    const unitControl = findPressableWithA11yLabel(tree.root, "invoices.fields.unit")[0];
    expect(unitControl.props.hitSlop).toBe(8);
    expect(String(unitControl.props.className)).toContain("h-11");
    expect(String(unitControl.props.className)).not.toContain("h-9");

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

describe("LineItemRow — compact card layout (responsive-line-item-grid)", () => {
  beforeEach(() => {
    mockConfirmAsync.mockReset();
  });

  const PRODUCT: Product = {
    id: "p1",
    userId: "u1",
    name: "Tanácsadás óra",
    unitPrice: 15000,
    unit: "óra",
    vatRate: 27,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("renders only the card, never the grid row, in card layout", () => {
    const { tree } = render({ layout: "card" });
    expect(tree.root.findAll((n) => n.props?.testID === "lineItem-0-grid-row")).toHaveLength(0);
    expect(tree.root.findAll((n) => n.props?.testID === "lineItem-0-card").length).toBeGreaterThan(0);
  });

  it("renders only the grid row, never the card, in grid layout", () => {
    const { tree } = render({ layout: "grid" });
    expect(tree.root.findAll((n) => n.props?.testID === "lineItem-0-card")).toHaveLength(0);
  });

  it("stacks description / qty+unit+price / VAT+total+delete in three rows", () => {
    const { tree } = render({ layout: "card" });
    const rows = ["description", "amounts", "vat"].map((name) =>
      tree.root.findAll((n) => n.props?.testID === `lineItem-0-card-${name}`)
    );
    for (const row of rows) expect(row.length).toBeGreaterThan(0);
    const amounts = rows[1][0];
    expect(amounts.findAll((n) => n.props?.testID === "lineItem-0-quantity").length).toBeGreaterThan(0);
    expect(amounts.findAll((n) => n.props?.accessibilityLabel === "invoices.fields.unit").length).toBeGreaterThan(0);
    expect(amounts.findAll((n) => n.props?.testID === "lineItem-0-unitPrice").length).toBeGreaterThan(0);
    const vatRow = rows[2][0];
    expect(
      vatRow.findAll((n) => n.props?.accessibilityLabel === "invoices.lineItemEditor.deleteAction").length
    ).toBeGreaterThan(0);
    expect(JSON.stringify(tree.toJSON())).toContain("571,500");
  });

  it("labels every input because the column headers are gone", () => {
    const { tree } = render({ layout: "card", index: 2 });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.lineItemEditor.lineLabel");
    expect(json).toContain("\\\"index\\\":3");
    expect(json).toContain("invoices.lineItemEditor.description");
    expect(json).toContain("invoices.lineItemEditor.quantity");
    expect(json).toContain("invoices.lineItemEditor.unitShort");
    expect(json).toContain("invoices.lineItemEditor.unitPrice");
    expect(json).toContain("invoices.vat.categoryLabel");
    expect(json).toContain("invoices.lineItemEditor.amountColumn");
    expect(json).toContain("invoices.lineItemEditor.netAbbrev");
  });

  it("keeps the UNIT_OPTIONS picker working in card layout", () => {
    const { tree, onChange } = render({ layout: "card" });
    const unitControl = findPressableWithA11yLabel(tree.root, "invoices.fields.unit")[0];
    expect(String(unitControl.props.className)).toContain("h-11");
    act(() => {
      unitControl.props.onPress?.();
    });
    const option = findPressableWithText(tree.root, "nap");
    expect(option).toBeTruthy();
    expect(String(option!.props.className)).toContain("min-h-11");
    act(() => {
      option!.props.onPress?.();
    });
    expect(onChange).toHaveBeenCalledWith({ unit: "nap" });
  });

  it("keeps the product autocomplete working in card layout", () => {
    const { tree, onFillFromProduct } = render({
      layout: "card",
      item: makeLineItem({ description: "Tan", quantity: 1, unitPrice: 0, vatRate: 27 }),
      products: [PRODUCT],
    });
    act(() => {
      tree.root.findByProps({ testID: "lineItem-0-description" }).props.onFocus?.();
    });
    const match = findPressableWithText(tree.root, "Tanácsadás óra");
    expect(match).toBeTruthy();
    expect(String(match!.props.className)).toContain("min-h-11");
    act(() => {
      match!.props.onPress?.();
    });
    expect(onFillFromProduct).toHaveBeenCalledWith(PRODUCT);
  });

  it("wires quantity and unit price edits through onChange", () => {
    const { tree, onChange } = render({ layout: "card" });
    act(() => {
      tree.root.findByProps({ testID: "lineItem-0-quantity" }).props.onChangeText("3");
      tree.root.findByProps({ testID: "lineItem-0-unitPrice" }).props.onChangeText("1200");
    });
    expect(onChange).toHaveBeenCalledWith({ quantity: 3 });
    expect(onChange).toHaveBeenCalledWith({ unitPrice: 1200 });
  });

  it("keeps a 44px delete target (h-11 w-11) that still confirms before deleting", async () => {
    mockConfirmAsync.mockResolvedValue(true);
    const { tree, onRemove } = render({ layout: "card" });
    const del = findPressableWithA11yLabel(tree.root, "invoices.lineItemEditor.deleteAction")[0];
    expect(String(del.props.className)).toContain("h-11");
    expect(String(del.props.className)).toContain("w-11");
    await act(async () => {
      await del.props.onPress?.();
    });
    expect(mockConfirmAsync).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalled();
  });

  // A 320px phone leaves 320 - 2x16 page padding - 2x13 card chrome = 262px
  // of card content; no fixed width/min-width inside the card may exceed it.
  it("uses no fixed pixel widths or min-widths that could force horizontal scrolling at 320px", () => {
    const { tree } = render({ layout: "card" });
    const card = tree.root.findAll((n) => n.props?.testID === "lineItem-0-card")[0];
    const classNames = card
      .findAll((n) => typeof n.props?.className === "string")
      .map((n) => String(n.props.className));
    for (const cls of classNames) {
      const fixed = [...cls.matchAll(/(?:^|\s)(?:min-)?w-\[(\d+)px\]/g)].map((m) => Number(m[1]));
      for (const px of fixed) expect(px).toBeLessThanOrEqual(240);
      expect(cls).not.toContain("overflow-x");
    }
    const styled = card.findAll((n) => typeof n.props?.style?.minWidth === "number");
    expect(styled).toHaveLength(0);
  });
});
