import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { OptionChips } from "@/components/settings/OptionChips";

jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

const options = [
  { value: "kata", label: "KATA" },
  { value: "tao", label: "TAO" },
] as const;

function render(value: "kata" | "tao" | undefined, clearable: boolean) {
  const onChange = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <OptionChips options={options} value={value} onChange={onChange} clearable={clearable} testIDPrefix="tax" />,
    );
  });
  const chip = (v: string) => tree.root.findAll((n) => n.props?.testID === `tax-${v}` && typeof n.props.onPress === "function")[0];
  return { onChange, chip };
}

describe("OptionChips", () => {
  it("selects the pressed option", () => {
    const { onChange, chip } = render(undefined, true);
    act(() => chip("tao").props.onPress());
    expect(onChange).toHaveBeenCalledWith("tao");
  });
  it("clears when the selected chip is pressed again, only if clearable", () => {
    const a = render("kata", true);
    act(() => a.chip("kata").props.onPress());
    expect(a.onChange).toHaveBeenCalledWith(undefined);
    const b = render("kata", false);
    act(() => b.chip("kata").props.onPress());
    expect(b.onChange).toHaveBeenCalledWith("kata");
  });
});
