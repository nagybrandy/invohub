// __tests__/screens/settings/settings-layout.test.tsx
// (Colocating this under app/(app)/settings/ would make Expo Router treat
// it as a conflicting `_layout` route, so it lives under __tests__/ instead,
// same as the other app-screen tests in __tests__/screens/.)
import TestRenderer, { act } from "react-test-renderer";
import SettingsLayout from "@/app/(app)/settings/_layout";

let mockPathname = "/settings";

jest.mock("expo-router", () => ({
  Slot: () => {
    const { Text } = require("@/__tests__/mocks/gluestack-ui");
    return <Text testID="slot-content">content</Text>;
  },
  usePathname: () => mockPathname,
  router: { push: jest.fn() },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#64748b" }),
}));

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

describe("Settings _layout", () => {
  it("does not render SettingsNav on the hub itself", () => {
    mockPathname = "/settings";
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<SettingsLayout />);
    });
    expect(JSON.stringify(tree!.toJSON())).not.toContain("settings.backToHub");
  });

  it("renders SettingsNav (back to hub) on a settings sub-page", () => {
    mockPathname = "/settings/pdf";
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<SettingsLayout />);
    });
    expect(JSON.stringify(tree!.toJSON())).toContain("settings.backToHub");
  });
});
