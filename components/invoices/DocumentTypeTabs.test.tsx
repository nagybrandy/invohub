// components/invoices/DocumentTypeTabs.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { DocumentTypeTabs, type DocumentType } from "@/components/invoices/DocumentTypeTabs";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

describe("DocumentType type", () => {
  it("keeps 'receipt' in the union for existing invoice-domain logic", () => {
    const types: DocumentType[] = ["invoice", "proforma", "advance", "receipt"];
    expect(types).toHaveLength(4);
  });
});

describe("DocumentTypeTabs", () => {
  it("never renders a 'Nyugta' tab — it used to navigate away and drop typed data (INV-14, E2)", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<DocumentTypeTabs selected="invoice" onChange={jest.fn()} />);
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain("invoices.documentTypes.invoice");
    expect(json).toContain("invoices.documentTypes.proforma");
    expect(json).toContain("invoices.documentTypes.advance");
    expect(json).not.toContain("invoices.documentTypes.receipt");
  });

  it("calls onChange when a tab is pressed", () => {
    const onChange = jest.fn();
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<DocumentTypeTabs selected="invoice" onChange={onChange} />);
    });
    const tab = tree!.root
      .findAll((node) => typeof node.props?.onPress === "function")
      .find((node) =>
        node.findAll((child) => child.props?.children === "invoices.documentTypes.proforma").length > 0
      );
    act(() => {
      tab?.props.onPress?.();
    });
    expect(onChange).toHaveBeenCalledWith("proforma");
  });

  it("renders each tab at a >=44px tap target (AC11)", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<DocumentTypeTabs selected="invoice" onChange={jest.fn()} />);
    });
    const tabs = tree!.root.findAll(
      (node) => node.props?.accessibilityRole === "tab" && typeof node.props?.className === "string"
    );
    expect(tabs.length).toBeGreaterThan(0);
    for (const tab of tabs) {
      expect(String(tab.props.className)).toContain("min-h-11");
    }
  });

  it("disables the tabs while editing an existing invoice — onChange never fires (spec §2.7)", () => {
    const onChange = jest.fn();
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<DocumentTypeTabs selected="invoice" onChange={onChange} disabled />);
    });
    const tab = tree!.root
      .findAll((node) => typeof node.props?.onPress === "function")
      .find((node) =>
        node.findAll((child) => child.props?.children === "invoices.documentTypes.proforma").length > 0
      );
    act(() => {
      tab?.props.onPress?.();
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
