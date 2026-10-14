// components/settings/NavEnvironmentPicker.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { NavEnvironmentPicker } from "@/components/settings/NavEnvironmentPicker";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

describe("NavEnvironmentPicker", () => {
  it("renders demo, test, and live labels", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<NavEnvironmentPicker value="test" onChange={jest.fn()} />);
    });

    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain("company.navMode.demo");
    expect(json).toContain("company.navMode.test");
    expect(json).toContain("company.navMode.production");
  });

  it("calls onChange with test when the test option is pressed", () => {
    const onChange = jest.fn();
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<NavEnvironmentPicker value="demo" onChange={onChange} />);
    });

    const testPressable = tree!.root
      .findAll((node) => typeof node.props?.onPress === "function")
      .find((node) => node.findAll((child) => child.props?.children === "company.navMode.test").length > 0);

    act(() => {
      testPressable?.props.onPress?.();
    });

    expect(onChange).toHaveBeenCalledWith("test");
  });

  it("does not call onChange when the disabled production option is pressed", () => {
    const onChange = jest.fn();
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<NavEnvironmentPicker value="demo" onChange={onChange} />);
    });

    const prodPressable = tree!.root
      .findAll((node) => typeof node.props?.onPress === "function")
      .find(
        (node) => node.findAll((child) => child.props?.children === "company.navMode.production").length > 0
      );

    expect(prodPressable?.props.disabled).toBe(true);

    act(() => {
      prodPressable?.props.onPress?.();
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the production-disabled hint only when production is selected", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<NavEnvironmentPicker value="demo" onChange={jest.fn()} />);
    });
    expect(JSON.stringify(tree!.toJSON())).not.toContain("productionDisabledHint");

    act(() => {
      tree = TestRenderer.create(<NavEnvironmentPicker value="production" onChange={jest.fn()} />);
    });
    expect(JSON.stringify(tree!.toJSON())).toContain("productionDisabledHint");
  });
});

describe("when the server has enabled production (NAV_PRODUCTION_ENABLED=true)", () => {
  function render(props: Partial<React.ComponentProps<typeof NavEnvironmentPicker>> = {}) {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <NavEnvironmentPicker value={props.value ?? "test"} onChange={props.onChange ?? jest.fn()} productionEnabled />
      );
    });
    return tree;
  }
  function productionPressable(tree: TestRenderer.ReactTestRenderer) {
    return tree.root.findAll(
      (node) =>
        typeof node.props?.onPress === "function" &&
        node.findAll((child) => child.props?.children === "company.navMode.production").length > 0
    )[0];
  }

  it("makes the live option selectable and reports the choice", () => {
    const onChange = jest.fn();
    const tree = render({ onChange });
    const prod = productionPressable(tree);
    expect(prod.props.disabled).toBe(false);
    act(() => prod.props.onPress());
    expect(onChange).toHaveBeenCalledWith("production");
  });

  it("says what live means instead of the disabled hint once production is selected", () => {
    const json = JSON.stringify(render({ value: "production" }).toJSON());
    expect(json).toContain("productionEnabledHint");
    expect(json).not.toContain("productionDisabledHint");
  });

  it("keeps the live option disabled by default — the server has to say yes first", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<NavEnvironmentPicker value="test" onChange={jest.fn()} />);
    });
    expect(productionPressable(tree).props.disabled).toBe(true);
  });
});
