// components/invoices/LineItemEditor.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { LineItemEditor } from "@/components/invoices/LineItemEditor";
import { makeLineItem } from "@/__tests__/fixtures/invoices";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", primary: "#4f46e5" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/components/ui/button", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/input", () => {
  const { TextInput } = require("react-native");
  return {
    Input: ({ children }: { children?: React.ReactNode }) => children ?? null,
    InputField: (props: Record<string, unknown>) => <TextInput {...props} />,
  };
});
jest.mock("@/components/ui/form-control", () => {
  const mockUi = require("@/__tests__/mocks/gluestack-ui");
  return {
    FormControl: mockUi.View,
    FormControlLabel: mockUi.View,
    FormControlLabelText: mockUi.Text,
  };
});

function renderEditor(props: Partial<React.ComponentProps<typeof LineItemEditor>> = {}) {
  const onChange = props.onChange ?? jest.fn();
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <LineItemEditor
        lineItems={props.lineItems ?? [makeLineItem()]}
        currency={props.currency ?? "HUF"}
        onChange={onChange}
        companyVatExempt={props.companyVatExempt}
      />
    );
  });
  return { tree: tree!, onChange };
}

function findPressableWithText(root: TestRenderer.ReactTestInstance, text: string) {
  return root
    .findAll((node) => typeof node.props?.onPress === "function")
    .find(
      (node) => node.findAll((child) => child.props?.children === text).length > 0
    );
}

describe("LineItemEditor", () => {
  it("renders the VAT category buttons", () => {
    const { tree } = renderEditor();
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.vat.category.normal");
    expect(json).toContain("invoices.vat.category.AAM");
    expect(json).toContain("invoices.vat.category.FAD");
  });

  it("shows a rate picker for a normal-category line", () => {
    const { tree } = renderEditor({ lineItems: [makeLineItem({ vatCategory: "normal" })] });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.lineItemEditor.vatRate");
  });

  it("shows the exemption reason field instead of a rate picker for an exempt category", () => {
    const { tree } = renderEditor({
      lineItems: [makeLineItem({ vatCategory: "AAM", vatRate: 0 })],
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain("invoices.lineItemEditor.vatRate");
    expect(json).toContain("invoices.vat.reasonLabel");
  });

  it("switching to AAM zeroes the VAT rate", () => {
    const { tree, onChange } = renderEditor({
      lineItems: [makeLineItem({ id: "line-1", vatCategory: "normal", vatRate: 27 })],
    });

    const pressable = findPressableWithText(tree.root, "invoices.vat.category.AAM");
    act(() => {
      pressable?.props.onPress?.();
    });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "line-1", vatCategory: "AAM", vatRate: 0 }),
    ]);
  });

  it("switching back to normal restores 27% VAT", () => {
    const { tree, onChange } = renderEditor({
      lineItems: [makeLineItem({ id: "line-1", vatCategory: "AAM", vatRate: 0 })],
    });

    const pressable = findPressableWithText(tree.root, "invoices.vat.category.normal");
    act(() => {
      pressable?.props.onPress?.();
    });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "line-1", vatCategory: "normal", vatRate: 27 }),
    ]);
  });

  it("adding a line defaults to AAM/0% for a VAT-exempt company", () => {
    const { tree, onChange } = renderEditor({ companyVatExempt: true });

    const pressable = findPressableWithText(tree.root, "invoices.lineItemEditor.addLineItem");
    act(() => {
      pressable?.props.onPress?.();
    });

    const [callArgs] = onChange.mock.calls[0] as [unknown[]];
    const added = callArgs[1] as { vatCategory: string; vatRate: number };
    expect(added.vatCategory).toBe("AAM");
    expect(added.vatRate).toBe(0);
  });

  it("adding a line defaults to normal/27% for a non-exempt company", () => {
    const { tree, onChange } = renderEditor({ companyVatExempt: false });

    const pressable = findPressableWithText(tree.root, "invoices.lineItemEditor.addLineItem");
    act(() => {
      pressable?.props.onPress?.();
    });

    const [callArgs] = onChange.mock.calls[0] as [unknown[]];
    const added = callArgs[1] as { vatCategory: string; vatRate: number };
    expect(added.vatCategory).toBe("normal");
    expect(added.vatRate).toBe(27);
  });
});
