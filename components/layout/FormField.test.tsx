// components/layout/FormField.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { TextInput } from "react-native";
import { FormField } from "@/components/layout/FormField";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

function render(props: React.ComponentProps<typeof FormField>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<FormField {...props} />);
  });
  return tree!;
}

describe("FormField", () => {
  it("renders the label and children", () => {
    const tree = render({
      label: "Partner neve",
      children: <TextInput testID="input" />,
    });
    expect(tree.root.findByProps({ testID: "input" })).toBeTruthy();
  });

  it("renders a required marker when required", () => {
    const tree = render({
      label: "Partner neve",
      required: true,
      children: <TextInput />,
    });
    const marker = tree.root.findByProps({ testID: "form-field-required" });
    expect(marker.props.children).toBe("*");
  });

  it("renders no required marker by default", () => {
    const tree = render({ label: "Megjegyzés", children: <TextInput /> });
    expect(() => tree.root.findByProps({ testID: "form-field-required" })).toThrow();
  });

  it("renders the hint when there is no error", () => {
    const tree = render({
      label: "Fizetési határidő",
      hint: "Alapértelmezés: 8 nap",
      children: <TextInput />,
    });
    const hint = tree.root.findByProps({ testID: "form-field-hint" });
    expect(hint.props.children).toBe("Alapértelmezés: 8 nap");
  });

  it("renders the error message directly under the field and hides the hint", () => {
    const tree = render({
      label: "Fizetési határidő",
      hint: "Alapértelmezés: 8 nap",
      error: "A határidő nem lehet korábbi, mint a kiállítás dátuma",
      children: <TextInput testID="input" />,
    });
    const error = tree.root.findByProps({ testID: "form-field-error" });
    expect(error.props.children).toBe("A határidő nem lehet korábbi, mint a kiállítás dátuma");
    expect(() => tree.root.findByProps({ testID: "form-field-hint" })).toThrow();
  });

  it("applies a destructive border to the child when there is an error", () => {
    const tree = render({
      label: "Partner neve",
      error: "Kötelező mező",
      children: <TextInput testID="input" className="base-class" />,
    });
    const input = tree.root.findByProps({ testID: "input" });
    expect(input.props.className).toContain("border-destructive");
    expect(input.props.className).toContain("base-class");
  });
});
