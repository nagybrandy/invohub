// components/invoices/composer/DateInput.test.tsx
import { Platform } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { DateInput } from "@/components/invoices/composer/DateInput";
import { MIN_TAP_TARGET_PX } from "@/lib/ui/tap-target";

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

    it("renders a 44px-tall native date input at the tap-target floor", () => {
      const { tree } = render();
      const node = tree.root.find((n) => n.props?.["data-testid"] === "date-input");
      expect(node.props.style.height).toBe(MIN_TAP_TARGET_PX);
      expect(node.props.style.height).toBe(44);
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
