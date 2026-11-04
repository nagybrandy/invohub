// components/ui/select/select.test.tsx
// Native Select: 42px field, opens a radio list, selecting closes and reports.
import TestRenderer, { act } from "react-test-renderer";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#666", primary: "#00c" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/heading", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));

import { Select, SELECT_HEIGHT_PX } from "@/components/ui/select";

const OPTIONS = [
  { value: "all", label: "Minden időszak" },
  { value: "2026-11", label: "2026. november" },
  { value: "2026-10", label: "2026. október", disabled: true },
] as const;

function render(props: Partial<React.ComponentProps<typeof Select>> = {}) {
  const onChange = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <Select value="all" onChange={onChange} options={OPTIONS} accessibilityLabel="Időszak" {...props} />,
    );
  });
  return { tree, onChange };
}

describe("Select (native)", () => {
  it("is a 42px combobox showing the selected label", () => {
    expect(SELECT_HEIGHT_PX).toBe(42);
    const { tree } = render();
    const field = tree.root.findByProps({ testID: "select" });
    expect(field.props.accessibilityRole).toBe("combobox");
    expect(field.props.accessibilityLabel).toBe("Időszak");
    expect(field.props.style).toEqual({ height: 42 });
    expect(JSON.stringify(tree.toJSON())).toContain("Minden időszak");
  });

  it("shows the placeholder when nothing is selected", () => {
    const { tree } = render({ value: "", placeholder: "Válassz" });
    expect(JSON.stringify(tree.toJSON())).toContain("Válassz");
  });

  it("opens the options, reports a different choice and closes", () => {
    const { tree, onChange } = render();
    act(() => tree.root.findByProps({ testID: "select" }).props.onPress());
    act(() => tree.root.findByProps({ testID: "select-option-2026-11" }).props.onPress());
    expect(onChange).toHaveBeenCalledWith("2026-11");
  });

  it("choosing the current value does not fire onChange", () => {
    const { tree, onChange } = render();
    act(() => tree.root.findByProps({ testID: "select" }).props.onPress());
    act(() => tree.root.findByProps({ testID: "select-option-all" }).props.onPress());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("marks the selected option as checked and carries disabled options", () => {
    const { tree } = render();
    act(() => tree.root.findByProps({ testID: "select" }).props.onPress());
    expect(tree.root.findByProps({ testID: "select-option-all" }).props.accessibilityState).toMatchObject({ checked: true });
    expect(tree.root.findByProps({ testID: "select-option-2026-10" }).props.disabled).toBe(true);
  });

  it("invalid uses the err border; disabled uses the wash2 field", () => {
    const invalid = render({ invalid: true });
    expect(invalid.tree.root.findByProps({ testID: "select" }).props.className).toContain("border-err");
    const disabled = render({ disabled: true });
    expect(disabled.tree.root.findByProps({ testID: "select" }).props.className).toContain("bg-wash2");
    expect(disabled.tree.root.findByProps({ testID: "select" }).props.disabled).toBe(true);
  });
});
