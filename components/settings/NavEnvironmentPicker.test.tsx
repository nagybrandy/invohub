// components/settings/NavEnvironmentPicker.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { NavEnvironmentPicker } from "@/components/settings/NavEnvironmentPicker";

jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

describe("NavEnvironmentPicker", () => {
  it("renders test and live labels", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <NavEnvironmentPicker value="test" onChange={jest.fn()} />
      );
    });

    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain("Teszt környezet");
    expect(json).toContain("Élő környezet");
  });

  it("calls onChange with production when live is pressed", () => {
    const onChange = jest.fn();
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <NavEnvironmentPicker value="test" onChange={onChange} />
      );
    });

    const livePressable = tree!.root
      .findAll((node) => typeof node.props?.onPress === "function")
      .find((node) =>
        node.findAll((child) => child.props?.children === "Élő környezet").length > 0
      );

    act(() => {
      livePressable?.props.onPress?.();
    });

    expect(onChange).toHaveBeenCalledWith("production");
  });
});
