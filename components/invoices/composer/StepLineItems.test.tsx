// components/invoices/composer/StepLineItems.test.tsx
// "Mit számlázol?" after the redesign: one header line and one row per item at
// container >= 820 (the header cells come from the shared COMPOSER_GRID_COLUMNS
// table, so header and rows cannot drift), the stacked layout below that, the
// "+ Új tétel" button, the "Gyors hozzáadás" chips (first five products), the
// gross-entry switch, the VAT row that is never dropped from the totals
// (INV-13) and the totals block.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StepLineItems } from "@/components/invoices/composer/StepLineItems";
import { COMPOSER_GRID_COLUMNS } from "@/components/invoices/composer/grid-columns";
import { makeLineItem } from "@/__tests__/fixtures/invoices";
import type { Product } from "@/lib/products/service";

const mockUi = require("@/__tests__/mocks/gluestack-ui");
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/heading", () => ({ Heading: require("@/__tests__/mocks/gluestack-ui").Text }));
jest.mock("@/components/ui/button", () => ({
  Button: require("@/__tests__/mocks/gluestack-ui").Pressable,
  ButtonText: require("@/__tests__/mocks/gluestack-ui").Text,
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", primary: "#4f46e5" }),
}));

// LineItemRow has its own coverage (LineItemRow.test.tsx) — stub it so this
// file stays about the section's own header / totals / chips wiring.
jest.mock("@/components/invoices/composer/LineItemRow", () => ({
  LineItemRow: ({
    item,
    layout,
    compact,
    priceMode,
    focusDescription,
  }: {
    item: { id: string; description: string };
    layout: string;
    compact: boolean;
    priceMode: string;
    focusDescription: boolean;
  }) => {
    const { Text } = require("react-native");
    return (
      <Text testID={`row-${item.id}`} accessibilityHint={`layout:${layout};compact:${compact};mode:${priceMode};focus:${focusDescription}`}>
        {item.description}
      </Text>
    );
  },
}));

const t = (key: string, opts?: Record<string, unknown>) =>
  opts ? `${key}:${JSON.stringify(opts)}` : key;

function product(n: number): Product {
  return {
    id: `prod-${n}`,
    userId: "u1",
    name: `Termék ${n}`,
    unit: "db",
    unitPrice: 100 * n,
    vatRate: 27,
    createdAt: "",
    updatedAt: "",
  };
}

function render(overrides: Partial<React.ComponentProps<typeof StepLineItems>> = {}) {
  const onUpdate = jest.fn();
  const onAdd = jest.fn();
  const onAddFromProduct = jest.fn();
  const onRemove = jest.fn();
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <StepLineItems
        lineItems={overrides.lineItems ?? [makeLineItem({ id: "l1", description: "Tanácsadás", quantity: 1, unitPrice: 450000 })]}
        currency={overrides.currency ?? "HUF"}
        products={overrides.products ?? [product(1)]}
        onUpdate={onUpdate}
        onAdd={onAdd}
        onAddFromProduct={onAddFromProduct}
        onRemove={onRemove}
        isModification={overrides.isModification}
        error={overrides.error}
        focusField={overrides.focusField}
        onFocusHandled={overrides.onFocusHandled}
        t={t}
      />
    );
  });
  return { tree: tree!, onUpdate, onAdd, onAddFromProduct, onRemove };
}

/** Simulates the section being laid out at `width` px (onLayout). */
function measure(tree: TestRenderer.ReactTestRenderer, width: number) {
  const container = tree.root.findAll((n) => n.props?.testID === "line-items-container" && typeof n.props?.onLayout === "function")[0];
  act(() => {
    container.props.onLayout({ nativeEvent: { layout: { width, height: 600, x: 0, y: 0 } } });
  });
}

function byTestID(root: TestRenderer.ReactTestInstance, testID: string) {
  return root.findAll((n) => n.props?.testID === testID);
}

function json(tree: TestRenderer.ReactTestRenderer) {
  return JSON.stringify(tree.toJSON());
}

describe("StepLineItems — layout follows the section's own width", () => {
  it("shows one header line with a cell per COMPOSER_GRID_COLUMNS entry from 820px", () => {
    const { tree } = render();
    measure(tree, 1000);
    const header = byTestID(tree.root, "line-items-grid-header").find((n) => Array.isArray(n.children) && n.children.length > 1);
    expect(header).toBeTruthy();
    expect(header!.children).toHaveLength(COMPOSER_GRID_COLUMNS.length);
    for (const col of COMPOSER_GRID_COLUMNS) {
      if (col.labelKey && col.key !== "unitPrice") expect(json(tree)).toContain(col.labelKey);
    }
    expect(byTestID(tree.root, "row-l1")[0].props.accessibilityHint).toContain("layout:row");
  });

  it("labels the unit-price column with the entry mode", () => {
    const { tree } = render();
    measure(tree, 1000);
    expect(json(tree)).toContain("invoices.lineItemEditor.priceNet");
    act(() => byTestID(tree.root, "unit-price-mode-switch")[0].props.onValueChange?.(true) ?? byTestID(tree.root, "unit-price-mode-switch")[0].props.onPress?.());
    expect(json(tree)).toContain("invoices.lineItemEditor.priceGross");
  });

  it("drops the header line and stacks each item below 820px (and while unmeasured)", () => {
    const { tree } = render();
    expect(byTestID(tree.root, "line-items-grid-header")).toHaveLength(0);
    expect(byTestID(tree.root, "row-l1")[0].props.accessibilityHint).toContain("layout:stacked");
    measure(tree, 819);
    expect(byTestID(tree.root, "line-items-grid-header")).toHaveLength(0);
  });

  it("moves Összesen to its own line only in a narrow container", () => {
    const { tree } = render();
    measure(tree, 343);
    expect(byTestID(tree.root, "row-l1")[0].props.accessibilityHint).toContain("compact:true");
    measure(tree, 700);
    expect(byTestID(tree.root, "row-l1")[0].props.accessibilityHint).toContain("compact:false");
  });

  it("renders one row per item, in order, with no numbering of its own", () => {
    const { tree } = render({
      lineItems: [makeLineItem({ id: "a", description: "Első" }), makeLineItem({ id: "b", description: "Második" })],
    });
    expect(byTestID(tree.root, "row-a").length).toBeGreaterThan(0);
    expect(byTestID(tree.root, "row-b").length).toBeGreaterThan(0);
    expect(json(tree).indexOf("Első")).toBeLessThan(json(tree).indexOf("Második"));
    expect(json(tree)).not.toContain("lineLabel");
  });
});

describe("StepLineItems — adding items", () => {
  it("adds an empty line from '+ Új tétel'", () => {
    const { tree, onAdd } = render();
    act(() => byTestID(tree.root, "composer-add-item")[0].props.onPress());
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(json(tree)).toContain("composer.addItem");
  });

  it("offers the first five products as dashed 'Gyors hozzáadás' chips and adds from a chip (INV-5)", () => {
    const products = [1, 2, 3, 4, 5, 6, 7].map(product);
    const { tree, onAddFromProduct } = render({ products });
    expect(json(tree)).toContain("composer.quickAdd");
    for (const n of [1, 2, 3, 4, 5]) expect(byTestID(tree.root, `composer-quick-add-prod-${n}`).length).toBeGreaterThan(0);
    expect(byTestID(tree.root, "composer-quick-add-prod-6")).toHaveLength(0);
    const chip = byTestID(tree.root, "composer-quick-add-prod-3")[0];
    expect(String(chip.props.className)).toContain("border-dashed");
    act(() => chip.props.onPress());
    expect(onAddFromProduct).toHaveBeenCalledWith(products[2]);
  });

  it("shows no quick-add row when the user has no products", () => {
    const { tree } = render({ products: [] });
    expect(byTestID(tree.root, "composer-quick-add")).toHaveLength(0);
    expect(json(tree)).not.toContain("composer.quickAdd");
  });

  it("does not claim an Enter-adds-a-row tip (the composer does not do that)", () => {
    expect(json(render().tree)).not.toMatch(/\bEnter\b|enterTip/i);
  });
});

describe("StepLineItems — gross entry", () => {
  it("starts in net mode and flips every row to gross with the switch", () => {
    const { tree } = render();
    expect(byTestID(tree.root, "row-l1")[0].props.accessibilityHint).toContain("mode:net");
    const toggle = byTestID(tree.root, "unit-price-mode-switch").find((n) => typeof n.props.onPress === "function")!;
    act(() => toggle.props.onPress());
    expect(byTestID(tree.root, "row-l1")[0].props.accessibilityHint).toContain("mode:gross");
    expect(json(tree)).toContain("invoices.fields.grossToggle");
  });
});

describe("StepLineItems — totals", () => {
  it("shows net, a VAT row per rate and the gross total", () => {
    const { tree } = render({
      lineItems: [
        makeLineItem({ id: "a", description: "x", quantity: 1, unitPrice: 1000, vatRate: 27, vatCategory: "normal" }),
        makeLineItem({ id: "b", description: "y", quantity: 1, unitPrice: 1000, vatRate: 5, vatCategory: "normal" }),
      ],
    });
    const out = json(tree);
    expect(out).toContain("invoices.totals.netTotal");
    expect(out).toContain("invoices.composer.vatRowLabel");
    expect(out).toContain("27%");
    expect(out).toContain("5%");
    expect(out).toContain("invoices.totals.grossTotal");
    expect(byTestID(tree.root, "composer-totals-gross").length).toBeGreaterThan(0);
  });

  it("never drops the VAT row, even before any line has a description (INV-13)", () => {
    const { tree } = render({ lineItems: [makeLineItem({ id: "a", description: "" })] });
    expect(json(tree)).toContain("invoices.composer.vatRowEmpty");
  });
});

describe("StepLineItems — messages and requests", () => {
  it("shows the line-item error under the rows", () => {
    const { tree } = render({ error: "Legalább egy tételt adj meg." });
    expect(byTestID(tree.root, "composer-items-error").length).toBeGreaterThan(0);
    expect(json(tree)).toContain("Legalább egy tételt adj meg.");
  });

  it("shows the helyesbítő hint for a correction draft", () => {
    expect(byTestID(render({ isModification: true }).tree.root, "modification-draft-hint").length).toBeGreaterThan(0);
    expect(byTestID(render().tree.root, "modification-draft-hint")).toHaveLength(0);
  });

  it("asks only the first row to take focus when a failed save wants the first description", () => {
    const { tree } = render({
      focusField: "lineItem-0-description",
      lineItems: [makeLineItem({ id: "a", description: "" }), makeLineItem({ id: "b", description: "" })],
    });
    expect(byTestID(tree.root, "row-a")[0].props.accessibilityHint).toContain("focus:true");
    expect(byTestID(tree.root, "row-b")[0].props.accessibilityHint).toContain("focus:false");
  });
});
