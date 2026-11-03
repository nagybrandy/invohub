// components/invoices/composer/LineItemRow.test.tsx
// One line item in the redesigned composer (tokens.md §6.18): a single row
// whose cells take their widths from COMPOSER_GRID_COLUMNS, or — in a narrower
// container — Megnevezés over one labelled line of numbers. No row numbers,
// 38px cells, delete with confirmation, product autocomplete, unit and VAT as
// selects (VatCategoryPicker / ItemSelect have their own coverage — stubbed).
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
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/input", () => {
  const { TextInput, View } = require("react-native");
  return {
    Input: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <View className={className}>{children}</View>
    ),
    InputField: (props: Record<string, unknown>) => <TextInput {...props} />,
  };
});

type SelectProps = {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  testID?: string;
  accessibilityLabel: string;
};
const selects: Record<string, SelectProps> = {};
jest.mock("@/components/invoices/composer/ItemSelect", () => ({
  ItemSelect: (props: SelectProps) => {
    selects[props.testID ?? props.accessibilityLabel] = props;
    return null;
  },
}));
let lastVat: { onChange: (next: { category: string; rate: number }) => void } | null = null;
jest.mock("@/components/invoices/composer/VatCategoryPicker", () => ({
  VatCategoryPicker: (props: { onChange: (next: { category: string; rate: number }) => void }) => {
    lastVat = props;
    return null;
  },
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
        layout={overrides.layout ?? "row"}
        compact={overrides.compact}
        index={overrides.index ?? 0}
        item={overrides.item ?? makeLineItem({ description: "Tanácsadás", quantity: 1, unitPrice: 450000, vatRate: 27 })}
        currency={overrides.currency ?? "HUF"}
        products={overrides.products ?? PRODUCTS}
        canDelete={overrides.canDelete ?? true}
        onChange={onChange}
        onRemove={onRemove}
        onFillFromProduct={onFillFromProduct}
        allowNegativeQuantity={overrides.allowNegativeQuantity}
        priceMode={overrides.priceMode}
        t={t}
      />
    );
  });
  return { tree: tree!, onChange, onRemove, onFillFromProduct };
}

function byTestID(root: TestRenderer.ReactTestInstance, testID: string) {
  return root.findAll((node) => node.props?.testID === testID);
}

function texts(tree: TestRenderer.ReactTestRenderer) {
  return JSON.stringify(tree.toJSON());
}

describe("LineItemRow — one row per item (container >= 820)", () => {
  beforeEach(() => {
    mockConfirmAsync.mockReset();
  });

  it("renders one cell per COMPOSER_GRID_COLUMNS entry", () => {
    const { tree } = render();
    const row = byTestID(tree.root, "lineItem-0-row").find((n) => Array.isArray(n.children) && n.children.length > 1);
    expect(row).toBeTruthy();
    expect(row!.children).toHaveLength(COMPOSER_GRID_COLUMNS.length);
  });

  it("has no row number anywhere", () => {
    const { tree } = render({ index: 2 });
    expect(texts(tree)).not.toContain("lineLabel");
    expect(texts(tree)).not.toContain("3. ");
  });

  it("makes every input cell 38px high", () => {
    const { tree } = render();
    const inputs = tree.root.findAll((n) => n.type === "View" && typeof n.props?.className === "string" && n.props.className.includes("h-[38px]"));
    expect(inputs.length).toBeGreaterThanOrEqual(3);
  });

  it("types the quantity, the unit price and the description through onChange", () => {
    const { tree, onChange } = render();
    act(() => byTestID(tree.root, "lineItem-0-quantity")[0].props.onChangeText("3"));
    expect(onChange).toHaveBeenLastCalledWith({ quantity: 3 });
    act(() => byTestID(tree.root, "lineItem-0-unitPrice")[0].props.onChangeText("1200"));
    expect(onChange).toHaveBeenLastCalledWith({ unitPrice: 1200 });
    act(() => byTestID(tree.root, "lineItem-0-description")[0].props.onChangeText("Oktatás"));
    expect(onChange).toHaveBeenLastCalledWith({ description: "Oktatás" });
  });

  it("clamps a negative quantity to 0 unless it is a helyesbítő line", () => {
    const normal = render();
    act(() => byTestID(normal.tree.root, "lineItem-0-quantity")[0].props.onChangeText("-2"));
    expect(normal.onChange).toHaveBeenLastCalledWith({ quantity: 0 });

    const correction = render({ allowNegativeQuantity: true });
    act(() => byTestID(correction.tree.root, "lineItem-0-quantity")[0].props.onChangeText("-2"));
    expect(correction.onChange).toHaveBeenLastCalledWith({ quantity: -2 });
  });

  it("types a gross unit price and stores the net one", () => {
    const { tree, onChange } = render({
      priceMode: "gross",
      item: makeLineItem({ description: "x", quantity: 1, unitPrice: 100, vatRate: 27, vatCategory: "normal" }),
    });
    act(() => byTestID(tree.root, "lineItem-0-unitPrice")[0].props.onChangeText("127"));
    expect(onChange).toHaveBeenLastCalledWith({ unitPrice: 100 });
  });

  it("offers the unit as a select, keeps an unusual unit from a product in the list, and reports a pick", () => {
    const { onChange } = render({ item: makeLineItem({ description: "x", unit: "perc" }) });
    const unit = selects["lineItem-0-unit"];
    expect(unit.value).toBe("perc");
    expect(unit.options.map((o) => o.value)).toEqual(expect.arrayContaining(["perc", "db", "óra", "nap"]));
    act(() => unit.onChange("óra"));
    expect(onChange).toHaveBeenCalledWith({ unit: "óra" });
  });

  it("re-derives the net price when the VAT treatment changes while typing gross", () => {
    const { onChange } = render({
      priceMode: "gross",
      item: makeLineItem({ description: "x", unitPrice: 100, vatRate: 27, vatCategory: "normal" }),
    });
    act(() => lastVat!.onChange({ category: "AAM", rate: 0 }));
    // gross 127 stays 127 -> net 127 under AAM (0%)
    expect(onChange).toHaveBeenLastCalledWith({ vatCategory: "AAM", vatRate: 0, unitPrice: 127 });
  });

  it("changes the VAT treatment without touching the price in net mode", () => {
    const { onChange } = render();
    act(() => lastVat!.onChange({ category: "normal", rate: 18 }));
    expect(onChange).toHaveBeenLastCalledWith({ vatCategory: "normal", vatRate: 18 });
  });

  it("shows both the bruttó and the nettó figure in the Összesen cell", () => {
    const { tree } = render({ item: makeLineItem({ description: "x", quantity: 2, unitPrice: 100, vatRate: 27 }) });
    const json = texts(tree);
    expect(json).toContain("254"); // gross 2 x 127
    expect(json).toContain("invoices.lineItemEditor.netAbbrev");
  });

  it("deletes without asking when the description is empty", async () => {
    const { tree, onRemove } = render({ item: makeLineItem({ description: "" }) });
    await act(async () => {
      byTestID(tree.root, "lineItem-0-delete")[0].props.onPress();
    });
    expect(mockConfirmAsync).not.toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("asks before deleting a filled line and only removes it once confirmed", async () => {
    mockConfirmAsync.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { tree, onRemove } = render();
    await act(async () => {
      byTestID(tree.root, "lineItem-0-delete")[0].props.onPress();
    });
    expect(onRemove).not.toHaveBeenCalled();
    await act(async () => {
      byTestID(tree.root, "lineItem-0-delete")[0].props.onPress();
    });
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("shows no delete control when it is the only line, but keeps the column", () => {
    const { tree } = render({ canDelete: false });
    expect(byTestID(tree.root, "lineItem-0-delete")).toHaveLength(0);
    const row = byTestID(tree.root, "lineItem-0-row").find((n) => Array.isArray(n.children) && n.children.length > 1);
    expect(row!.children).toHaveLength(COMPOSER_GRID_COLUMNS.length);
  });

  it("keeps the line note field hidden until asked for, then shows it", () => {
    const { tree, onChange } = render();
    expect(byTestID(tree.root, "lineItem-0-comment")).toHaveLength(0);
    act(() => byTestID(tree.root, "lineItem-0-comment-add")[0].props.onPress());
    const field = byTestID(tree.root, "lineItem-0-comment")[0];
    expect(field).toBeTruthy();
    act(() => field.props.onChangeText("Megjegyzés"));
    expect(onChange).toHaveBeenLastCalledWith({ comment: "Megjegyzés" });
  });

  it("shows the note field straight away when the line already has one", () => {
    const { tree } = render({ item: makeLineItem({ description: "x", comment: "van" }) });
    expect(byTestID(tree.root, "lineItem-0-comment")[0].props.value).toBe("van");
  });
});

describe("LineItemRow — product autocomplete", () => {
  const products = [
    { id: "p1", name: "Webfejlesztés (óradíj)", unitPrice: 15000, vatRate: 27, unit: "óra" },
    { id: "p2", name: "Tanácsadás", unitPrice: 20000, vatRate: 27, unit: "óra" },
  ] as unknown as Product[];

  it("suggests matching products while the description is focused and fills from the pick", () => {
    const { tree, onFillFromProduct } = render({
      products,
      item: makeLineItem({ description: "tan", id: "l1" }),
    });
    expect(texts(tree)).not.toContain("Tanácsadás");
    act(() => byTestID(tree.root, "lineItem-0-description")[0].props.onFocus());
    expect(texts(tree)).toContain("Tanácsadás");
    expect(texts(tree)).not.toContain("Webfejlesztés");
    const option = tree.root.findAll(
      (n) => typeof n.props?.onPress === "function" && n.findAll((c) => c.props?.children === "Tanácsadás").length > 0
    )[0];
    act(() => option.props.onPress());
    expect(onFillFromProduct).toHaveBeenCalledWith(products[1]);
  });
});

describe("LineItemRow — stacked (container < 820)", () => {
  it("renders Megnevezés on its own line with the delete icon beside it, then ONE labelled line of numbers", () => {
    const { tree } = render({ layout: "stacked" });
    expect(byTestID(tree.root, "lineItem-0-row")).toHaveLength(0);
    expect(byTestID(tree.root, "lineItem-0-stacked").length).toBeGreaterThan(0);
    expect(byTestID(tree.root, "lineItem-0-numbers").length).toBeGreaterThan(0);
    const json = texts(tree);
    for (const label of [
      "invoices.lineItemEditor.description",
      "invoices.lineItemEditor.quantity",
      "invoices.lineItemEditor.unitShort",
      "invoices.fields.vat",
      "invoices.lineItemEditor.amountColumn",
    ]) {
      expect(json).toContain(label);
    }
    expect(byTestID(tree.root, "lineItem-0-delete").length).toBeGreaterThan(0);
  });

  it("labels the unit price with net or gross entry", () => {
    expect(texts(render({ layout: "stacked", priceMode: "net" }).tree)).toContain("invoices.lineItemEditor.priceNet");
    expect(texts(render({ layout: "stacked", priceMode: "gross" }).tree)).toContain("invoices.lineItemEditor.priceGross");
  });

  it("keeps Összesen on the numbers line when there is room, on its own dashed line when compact", () => {
    const roomy = render({ layout: "stacked", compact: false });
    expect(byTestID(roomy.tree.root, "lineItem-0-total-line")).toHaveLength(0);
    const narrow = render({ layout: "stacked", compact: true });
    expect(byTestID(narrow.tree.root, "lineItem-0-total-line").length).toBeGreaterThan(0);
  });

  it("separates stacked items with a rule from the second one on", () => {
    const first = render({ layout: "stacked", index: 0 });
    const second = render({ layout: "stacked", index: 1 });
    const cls = (r: ReturnType<typeof render>, i: number) => String(byTestID(r.tree.root, `lineItem-${i}-stacked`)[0].props.className);
    expect(cls(first, 0)).not.toContain("border-t");
    expect(cls(second, 1)).toContain("border-t");
  });

  it("uses no fixed widths wider than the screen that could force horizontal scrolling at 320px", () => {
    const { tree } = render({ layout: "stacked", compact: true });
    const widths = tree.root
      .findAll((n) => typeof n.props?.className === "string")
      .flatMap((n) => [...String(n.props.className).matchAll(/(?:^|\s)(?:min-)?w-\[(\d+)px\]/g)].map((m) => Number(m[1])));
    expect(Math.max(...widths)).toBeLessThanOrEqual(128);
    // the numbers line: 56 + 76 + 100 + gaps leaves room for the price at 343px
    expect(56 + 76 + 100 + 3 * 8).toBeLessThan(343 - 80);
  });
});
