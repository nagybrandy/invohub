// components/invoices/composer/DateInput.test.tsx
import { Platform } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { DateInput } from "@/components/invoices/composer/DateInput";
import { INPUT_HEIGHT_PX } from "@/components/ui/input";

function render(props: Partial<React.ComponentProps<typeof DateInput>> = {}) {
  const onChangeText = props.onChangeText ?? jest.fn();
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <DateInput
        value="2026-09-21"
        onChangeText={onChangeText}
        testID="date-input"
        {...props}
      />
    );
  });
  return { tree: tree!, onChangeText };
}

describe("DateInput", () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  describe("web branch", () => {
    beforeEach(() => {
      Platform.OS = "web";
    });

    it("renders a native date input as tall as every other form field (42px)", () => {
      const { tree } = render();
      const node = tree.root.find((n) => n.props?.["data-testid"] === "date-input");
      expect(node.props.type).toBe("date");
      expect(node.props.style.height).toBe(INPUT_HEIGHT_PX);
      expect(node.props.style.height).toBe(42);
    });

    it("uses the design tokens: a line-strong border, an err border when invalid", () => {
      const ok = render().tree.root.find((n) => n.props?.["data-testid"] === "date-input");
      expect(ok.props.className).toContain("border-line-strong");
      const bad = render({ invalid: true }).tree.root.find((n) => n.props?.["data-testid"] === "date-input");
      expect(bad.props.className).toContain("border-err");
      expect(bad.props["aria-invalid"]).toBe(true);
    });

    it("reports the typed value and carries its accessible name", () => {
      const { tree, onChangeText } = render({ accessibilityLabel: "Teljesítés dátuma" });
      const node = tree.root.find((n) => n.props?.["data-testid"] === "date-input");
      expect(node.props["aria-label"]).toBe("Teljesítés dátuma");
      act(() => node.props.onChange({ target: { value: "2026-11-05" } }));
      expect(onChangeText).toHaveBeenCalledWith("2026-11-05");
    });
  });

  describe("native branch", () => {
    beforeEach(() => {
      Platform.OS = "ios";
    });

    it("renders Input + InputField, forwarding data-invalid and testID", () => {
      const { tree } = render({ invalid: true });
      const field = tree.root.find((n) => n.props?.testID === "date-input");
      expect(field).toBeTruthy();
      const invalidNode = tree.root.find(
        (n) => n.props && Object.prototype.hasOwnProperty.call(n.props, "data-invalid")
      );
      expect(invalidNode.props["data-invalid"]).toBe(true);
    });
  });
});
