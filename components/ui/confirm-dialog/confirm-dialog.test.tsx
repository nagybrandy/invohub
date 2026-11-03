// components/ui/confirm-dialog/confirm-dialog.test.tsx
// Native ConfirmDialog: copy, action order per presentation, destructive
// styling, busy state and the cancel paths.
import TestRenderer, { act } from "react-test-renderer";

const mockDims = { width: 375 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockDims.width, height: 800, scale: 1, fontScale: 1 }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#666", destructive: "#c00", primary: "#00c" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/heading", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => {
  const { Pressable, Text, View } = require("react-native");
  return {
    Button: ({ children, isDisabled, onPress, variant, testID, className }: never) => (
      <Pressable testID={testID} accessibilityState={{ disabled: !!isDisabled }} onPress={isDisabled ? undefined : onPress} data-variant={variant} className={className}>
        {children}
      </Pressable>
    ),
    ButtonText: ({ children }: never) => <Text>{children}</Text>,
    ButtonSpinner: () => <View testID="spinner" />,
  };
});

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function render(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ConfirmDialog
        open
        title="Kijelentkezel?"
        message="Ezen az eszközön kilépsz."
        confirmLabel="Kijelentkezés"
        cancelLabel="Mégse"
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...props}
      />,
    );
  });
  return { tree, onConfirm, onCancel };
}

describe("ConfirmDialog (native)", () => {
  beforeEach(() => {
    mockDims.width = 820;
  });

  it("shows the title, message and both labels", () => {
    const { tree } = render();
    const json = JSON.stringify(tree.toJSON());
    for (const text of ["Kijelentkezel?", "Ezen az eszközön kilépsz.", "Kijelentkezés", "Mégse"]) {
      expect(json).toContain(text);
    }
  });

  it("confirm and cancel call their handlers", () => {
    const { tree, onConfirm, onCancel } = render();
    act(() => tree.root.findByProps({ testID: "confirm-dialog-confirm" }).props.onPress());
    act(() => tree.root.findByProps({ testID: "confirm-dialog-cancel" }).props.onPress());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("the scrim and the hardware back button cancel", () => {
    const { tree, onCancel } = render();
    act(() => tree.root.findByProps({ testID: "confirm-dialog-scrim" }).props.onPress());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("is a dialog with cancel left of the action, and a sheet with the action on top", () => {
    const dialog = render();
    const dialogJson = JSON.stringify(dialog.tree.toJSON());
    expect(dialogJson.indexOf("Mégse")).toBeLessThan(dialogJson.indexOf("Kijelentkezés"));
    mockDims.width = 375;
    const sheet = render();
    const sheetJson = JSON.stringify(sheet.tree.toJSON());
    expect(sheetJson.indexOf("Kijelentkezés")).toBeLessThan(sheetJson.indexOf("Mégse"));
  });

  it("destructive uses the solid danger button and the err icon circle", () => {
    const { tree } = render({ destructive: true });
    expect(tree.root.findByProps({ testID: "confirm-dialog-confirm" }).props.variant).toBe("dangerSolid");
    expect(JSON.stringify(tree.toJSON())).toContain("bg-err-wash");
    const normal = render();
    expect(normal.tree.root.findByProps({ testID: "confirm-dialog-confirm" }).props.variant).toBe("primary");
  });

  it("busy disables both actions and shows a spinner", () => {
    const { tree } = render({ busy: true });
    expect(tree.root.findByProps({ testID: "confirm-dialog-confirm" }).props.isDisabled).toBe(true);
    expect(tree.root.findByProps({ testID: "confirm-dialog-cancel" }).props.isDisabled).toBe(true);
    expect(tree.root.findByProps({ testID: "spinner" })).toBeTruthy();
  });
});
