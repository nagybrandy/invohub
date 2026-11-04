// __tests__/screens/settings/settings-layout.test.tsx
// (Colocating this under app/(app)/settings/ would make Expo Router treat
// it as a conflicting `_layout` route, so it lives under __tests__/ instead,
// same as the other app-screen tests in __tests__/screens/.)
// The frame measures its OWN width: >= 860 shows the left nav (and sends the
// bare /settings to Céges profil), narrower is one column with a back link.
import TestRenderer, { act } from "react-test-renderer";
import SettingsLayout from "@/app/(app)/settings/_layout";

let mockPathname = "/settings";
let mockWidth = 0;
const mockRedirect = jest.fn();

jest.mock("expo-router", () => ({
  Slot: () => {
    const { Text } = require("@/__tests__/mocks/gluestack-ui");
    return <Text testID="slot-content">content</Text>;
  },
  Redirect: (props: { href: string }) => {
    mockRedirect(props.href);
    return null;
  },
  usePathname: () => mockPathname,
  router: { push: jest.fn() },
}));

jest.mock("@/lib/ui/use-measured-width", () => ({
  useMeasuredWidth: () => ({ width: mockWidth, measured: mockWidth > 0, onLayout: jest.fn() }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});

jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ muted: "#64748b", primary: "#00c", faint: "#999" }),
}));

jest.mock("@/components/layout/ScreenLayout", () => ({
  ScreenLayout: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

for (const m of ["box", "hstack", "pressable", "text"]) {
  jest.mock(`@/components/ui/${m}`, () => require("@/__tests__/mocks/gluestack-ui"));
}

function render() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<SettingsLayout />);
  });
  const has = (id: string) => tree.root.findAll((n) => n.props?.testID === id).length > 0;
  return { has };
}

describe("Settings _layout", () => {
  beforeEach(() => {
    mockRedirect.mockClear();
    mockPathname = "/settings";
    mockWidth = 0;
  });

  it("renders nothing until the frame has been measured", () => {
    const { has } = render();
    expect(has("slot-content")).toBe(false);
    expect(has("settings-nav-column")).toBe(false);
  });

  describe("at a frame width of 1000 (wide)", () => {
    beforeEach(() => {
      mockWidth = 1000;
    });

    it("shows the left nav beside a settings sub-page, with no back link", () => {
      mockPathname = "/settings/pdf";
      const { has } = render();
      expect(has("settings-nav-column")).toBe(true);
      expect(has("settings-nav-pdf")).toBe(true);
      expect(has("settings-back-link")).toBe(false);
      expect(has("slot-content")).toBe(true);
    });

    it("sends the bare /settings to Céges profil", () => {
      mockPathname = "/settings";
      render();
      expect(mockRedirect).toHaveBeenCalledWith("/settings/company");
    });
  });

  describe("at a frame width of 500 (narrow)", () => {
    beforeEach(() => {
      mockWidth = 500;
    });

    it("keeps the start list free of a back link and nav", () => {
      mockPathname = "/settings";
      const { has } = render();
      expect(has("settings-back-link")).toBe(false);
      expect(has("settings-nav-column")).toBe(false);
      expect(has("slot-content")).toBe(true);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("gives a sub-page the back link, not the nav", () => {
      mockPathname = "/settings/pdf";
      const { has } = render();
      expect(has("settings-back-link")).toBe(true);
      expect(has("settings-nav-pdf")).toBe(false);
      expect(has("slot-content")).toBe(true);
    });
  });
});
