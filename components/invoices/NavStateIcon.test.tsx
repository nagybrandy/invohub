// components/invoices/NavStateIcon.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { NavStateIcon } from "@/components/invoices/NavStateIcon";
import { NavDot as ReExportedNavDot } from "@/components/invoices/NavDot";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#666", destructive: "#c00", ok: "#0a0" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: (_t, name) => (props: object) => <View testID={`icon-${String(name)}`} {...props} /> });
});
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

function render(props: React.ComponentProps<typeof NavStateIcon>) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<NavStateIcon {...props} />);
  });
  return tree;
}

describe("NavStateIcon", () => {
  it.each(["none", "notSubmitted"] as const)("renders an empty cell for %s", (status) => {
    expect(render({ status }).toJSON()).toBeNull();
  });

  it("failed: an outlined warning triangle button whose label is the NAV reason", () => {
    const tree = render({ status: "failed", reason: "Hibás adószám" });
    expect(tree.root.findByProps({ testID: "icon-AlertTriangle" })).toBeTruthy();
    const button = tree.root.findByProps({ testID: "invoice-row-nav-dot" });
    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityLabel).toBe("Hibás adószám");
    expect(button.props.accessibilityHint).toBe("failed");
    expect(button.props.className).toContain("h-[30px] w-[30px]");
    expect(button.props.className).toContain("data-[hover=true]:bg-err-wash");
  });

  it("failed without a reason falls back to the generic NAV hint", () => {
    const tree = render({ status: "failed" });
    expect(tree.root.findByProps({ testID: "invoice-row-nav-dot" }).props.accessibilityLabel).toBe(
      "invoices.list.navFailedHint",
    );
  });

  it("failed: pressing the button calls onPress", () => {
    const onPress = jest.fn();
    const tree = render({ status: "failed", onPress });
    act(() => tree.root.findByProps({ testID: "invoice-row-nav-dot" }).props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("done: a green tick at 55% opacity, not a button", () => {
    const tree = render({ status: "done" });
    expect(tree.root.findByProps({ testID: "icon-Check" })).toBeTruthy();
    const cell = tree.root.findByProps({ testID: "invoice-row-nav-dot" });
    expect(cell.props.className).toContain("opacity-55");
    expect(cell.props.accessibilityHint).toBe("done");
    expect(cell.props.accessibilityLabel).toBe("invoices.list.navDoneHint");
  });

  it("inProgress: a muted clock with a tooltip", () => {
    const tree = render({ status: "inProgress" });
    expect(tree.root.findByProps({ testID: "icon-Clock" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "invoice-row-nav-dot" }).props.accessibilityHint).toBe("inProgress");
  });

  it("keeps the NavDot export and test id for existing call sites", () => {
    expect(ReExportedNavDot).toBe(NavStateIcon);
    const tree = render({ status: "done", testID: "invoice-card-nav-dot" });
    expect(tree.root.findByProps({ testID: "invoice-card-nav-dot" })).toBeTruthy();
  });
});
