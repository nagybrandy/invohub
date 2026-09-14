// components/ui/date-field/DateField.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { TextInput } from "react-native";
import { DateField } from "@/components/ui/date-field";
import { DateField as DateFieldWeb } from "@/components/ui/date-field/index.web";

function render(props: React.ComponentProps<typeof DateField>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<DateField {...props} />);
  });
  return tree!;
}

function renderWeb(props: React.ComponentProps<typeof DateFieldWeb>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<DateFieldWeb {...props} />);
  });
  return tree!;
}

describe("DateField (native)", () => {
  it("renders a text field with the given ISO value", () => {
    const tree = render({ value: "2026-09-14", onChange: jest.fn() });
    const input = tree.root.findByType(TextInput);
    expect(input.props.value).toBe("2026-09-14");
  });

  it("calls onChange with the typed text", () => {
    const onChange = jest.fn();
    const tree = render({ value: "", onChange });
    const input = tree.root.findByType(TextInput);
    act(() => {
      input.props.onChangeText("2026-10-01");
    });
    expect(onChange).toHaveBeenCalledWith("2026-10-01");
  });

  it("renders empty string for an undefined value", () => {
    const tree = render({ onChange: jest.fn() });
    const input = tree.root.findByType(TextInput);
    expect(input.props.value).toBe("");
  });
});

describe("DateField (web)", () => {
  it("renders a native <input type=\"date\">", () => {
    const tree = renderWeb({ value: "2026-09-14", onChange: jest.fn() });
    const input = tree.root.findByProps({ "data-testid": "date-field" });
    expect(input.type).toBe("input");
    expect(input.props.type).toBe("date");
    expect(input.props.value).toBe("2026-09-14");
  });

  it("calls onChange with the picked value", () => {
    const onChange = jest.fn();
    const tree = renderWeb({ value: "", onChange });
    const input = tree.root.findByProps({ "data-testid": "date-field" });
    act(() => {
      input.props.onChange({ target: { value: "2026-12-25" } });
    });
    expect(onChange).toHaveBeenCalledWith("2026-12-25");
  });

  it("does not leak RN-only props onto the DOM node", () => {
    const tree = renderWeb({ value: "", onChange: jest.fn(), testID: "date-field" });
    const input = tree.root.findByProps({ "data-testid": "date-field" });
    expect(input.props.style).toBeUndefined();
  });
});
