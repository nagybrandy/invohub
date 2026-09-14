// components/navigation/SettingsNav.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { SettingsNav } from "@/components/navigation/SettingsNav";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#64748b" }),
}));

describe("SettingsNav", () => {
  it("shows a back-to-hub label", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<SettingsNav />);
    });
    expect(JSON.stringify(tree!.toJSON())).toContain("settings.backToHub");
  });

  it("navigates to /settings in one tap", () => {
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<SettingsNav />);
    });
    const link = tree!.root.find(
      (node) => node.props?.accessibilityLabel === "settings.backToHub",
    );
    act(() => link.props.onPress?.());
    expect(mockPush).toHaveBeenCalledWith("/settings");
  });
});
