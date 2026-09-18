// components/invoices/ScreenModeTabs.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { ScreenModeTabs } from "@/components/invoices/ScreenModeTabs";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

describe("ScreenModeTabs", () => {
  it("renders edit and preview labels", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ScreenModeTabs mode="edit" onChange={jest.fn()} />
      );
    });
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain("invoices.screenModes.edit");
    expect(json).toContain("invoices.screenModes.preview");
  });

  it("renders each tab at a >=44px tap target (AC11)", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<ScreenModeTabs mode="edit" onChange={jest.fn()} />);
    });
    const tabs = tree!.root.findAll(
      (node) => typeof node.props?.onPress === "function" && typeof node.props?.className === "string"
    );
    expect(tabs.length).toBeGreaterThan(0);
    for (const tab of tabs) {
      expect(String(tab.props.className)).toContain("min-h-11");
    }
  });

  it("calls onChange when preview pressed", () => {
    const onChange = jest.fn();
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ScreenModeTabs mode="edit" onChange={onChange} />
      );
    });

    const previewPressable = tree!.root
      .findAll((node) => typeof node.props?.onPress === "function")
      .find((node) =>
        node.findAll(
          (child) => child.props?.children === "invoices.screenModes.preview"
        ).length > 0
      );
    act(() => {
      previewPressable?.props.onPress?.();
    });
    expect(onChange).toHaveBeenCalledWith("preview");
  });
});
