// __tests__/screens/settings/settings-deep-link.test.tsx
// Regression: on a wide frame, loading /settings/<sub> directly must stay on
// that sub-page. It used to collapse to /settings (the frame mounted no <Slot/>
// until it had been measured) and then redirect to Céges profil.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, View } from "react-native";
import { Slot, Stack } from "expo-router";
// renderRouter() needs @testing-library/react-native's createRoot, which the
// repo's react-test-renderer shim (jest.config.js) does not have. So we mount
// ExpoRoot ourselves (that is all renderRouter does) with the same mock files.
import { getMockContext } from "expo-router/testing-library";
import { ExpoRoot } from "expo-router/build/ExpoRoot";
import { store } from "expo-router/build/global-state/router-store";
import SettingsLayout from "@/app/(app)/settings/_layout";

let mockWidth = 1000;

// The real hook measures after mount via onLayout. Mimic that: unmeasured on
// the first render, measured right after mount.
jest.mock("@/lib/ui/use-measured-width", () => {
  const React = require("react");
  return {
    useMeasuredWidth: () => {
      const [width, setWidth] = React.useState(0);
      const onLayout = React.useCallback(() => {}, []);
      React.useEffect(() => {
        const id = setTimeout(() => setWidth(mockWidth), 10);
        return () => clearTimeout(id);
      }, []);
      return { width, measured: width > 0, onLayout };
    },
  };
});

jest.mock("@/components/layout/ScreenLayout", () => ({
  ScreenLayout: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock("@/components/navigation/SettingsNav", () => ({
  SettingsNav: () => null,
}));

const page = (label: string) => () => <Text>{label}</Text>;

const files = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  index: page("landing"),
  // Stand-in for the auth gate: a spinner (no <Slot/>) while the session loads.
  "(app)/_layout": () => {
    const [ready, setReady] = React.useState(false);
    React.useEffect(() => {
      const id = setTimeout(() => setReady(true), 5);
      return () => clearTimeout(id);
    }, []);
    return ready ? <Slot /> : null;
  },
  "(app)/dashboard/index": page("dashboard"),
  "(app)/settings/_layout": SettingsLayout,
  "(app)/settings/index": page("start-page"),
  "(app)/settings/company": page("company-page"),
  "(app)/settings/templates": page("templates-page"),
  "(app)/settings/billing": page("billing-page"),
};

let tree: TestRenderer.ReactTestRenderer | undefined;

async function mount(initialUrl: string) {
  process.env.EXPO_ROUTER_IMPORT_MODE = "sync";
  await act(async () => {
    tree = TestRenderer.create(
      <ExpoRoot context={getMockContext(files as never)} location={initialUrl} />
    );
  });
  // Let the router's async state updates and effects (onLayout-style measuring,
  // redirects) run before asserting, or a transient right state would pass.
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  }
}

const pathname = () => store.getRouteInfo().pathname;
const shown = (label: string) =>
  tree!.root.findAll((n) => n.type === Text && n.props.children === label).length > 0;

afterEach(() => {
  act(() => tree?.unmount());
  tree = undefined;
});

describe("Settings deep links", () => {
  it.each(["templates", "billing"])("wide: /settings/%s stays on that page", async (sub) => {
    mockWidth = 1000;
    await mount(`/settings/${sub}`);
    expect(pathname()).toBe(`/settings/${sub}`);
    expect(shown(`${sub}-page`)).toBe(true);
  });

  it("wide: the bare /settings still redirects to Céges profil", async () => {
    mockWidth = 1000;
    await mount("/settings");
    expect(pathname()).toBe("/settings/company");
    expect(shown("company-page")).toBe(true);
  });

  it("narrow: /settings is the start list", async () => {
    mockWidth = 500;
    await mount("/settings");
    expect(pathname()).toBe("/settings");
    expect(shown("start-page")).toBe(true);
  });

  it("narrow: /settings/templates stays on that page", async () => {
    mockWidth = 500;
    await mount("/settings/templates");
    expect(pathname()).toBe("/settings/templates");
    expect(shown("templates-page")).toBe(true);
  });
});
