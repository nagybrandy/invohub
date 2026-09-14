// components/invoices/composer/VatCategoryPicker.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { VatCategoryPicker } from "@/components/invoices/composer/VatCategoryPicker";

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

const t = (key: string) => key;

function render(props: Partial<React.ComponentProps<typeof VatCategoryPicker>> = {}) {
  const onChangeCategory = props.onChangeCategory ?? jest.fn();
  const onChangeRate = props.onChangeRate ?? jest.fn();
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <VatCategoryPicker
        category={props.category ?? "normal"}
        rate={props.rate ?? 27}
        onChangeCategory={onChangeCategory}
        onChangeRate={onChangeRate}
        t={t}
      />
    );
  });
  return { tree: tree!, onChangeCategory, onChangeRate };
}

function findPressableWithText(root: TestRenderer.ReactTestInstance, text: string) {
  return root
    .findAll((node) => typeof node.props?.onPress === "function")
    .find((node) => node.findAll((child) => child.props?.children === text).length > 0);
}

describe("VatCategoryPicker (INV-7)", () => {
  it("shows exactly the 2 common categories by default", () => {
    const { tree } = render();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.vat.category.normal");
    expect(json).toContain("invoices.vat.category.AAM");
    expect(json).not.toContain("invoices.vat.category.TAM");
    expect(json).not.toContain("invoices.vat.category.FAD");
  });

  it("reveals the other 5 categories after expanding 'Speciális adózás'", () => {
    const { tree } = render();
    const toggle = findPressableWithText(tree.root, "invoices.vat.advancedToggle");
    act(() => {
      toggle?.props.onPress?.();
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.vat.category.TAM");
    expect(json).toContain("invoices.vat.category.KBAET");
    expect(json).toContain("invoices.vat.category.AHK");
    expect(json).toContain("invoices.vat.category.FAD");
    expect(json).toContain("invoices.vat.category.ATK");
  });

  it("calls onChangeCategory when AAM is picked", () => {
    const { tree, onChangeCategory } = render();
    const aam = findPressableWithText(tree.root, "invoices.vat.category.AAM");
    act(() => {
      aam?.props.onPress?.();
    });
    expect(onChangeCategory).toHaveBeenCalledWith("AAM");
  });

  it("shows a rate row only for the normal category", () => {
    const normal = render({ category: "normal" });
    expect(JSON.stringify(normal.tree.toJSON())).toContain('"27"');

    const aam = render({ category: "AAM" });
    expect(JSON.stringify(aam.tree.toJSON())).not.toContain('"27"');
  });
});
