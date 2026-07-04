// components/invoices/ScreenModeTabs.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { ScreenModeTabs } from "@/components/invoices/ScreenModeTabs";

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
    expect(json).toContain("edit");
    expect(json).toContain("preview");
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
        node.findAll((child) => child.props?.children === "preview").length > 0
      );
    act(() => {
      previewPressable?.props.onPress?.();
    });
    expect(onChange).toHaveBeenCalledWith("preview");
  });
});
