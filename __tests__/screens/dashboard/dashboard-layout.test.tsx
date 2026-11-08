// __tests__/screens/dashboard/dashboard-layout.test.tsx
// Főoldal top row (owner feedback 2026-11-06): from a 1100px CONTAINER the
// row is Kintlévőség | received + VAT | Következő lépések; narrower it stays
// as before (hero, stat cards, then the next-steps section on its own row).
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), replace: jest.fn(), back: jest.fn() },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
    i18n: { language: "hu", changeLanguage: jest.fn() },
  }),
}));

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});

jest.mock("@/db", () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: jest.fn().mockResolvedValue([]),
        })),
      })),
    })),
  },
}));

jest.mock("@/lib/auth-client", () => ({
  useSession: () => ({
    data: { user: { id: "user-1", name: "Test", email: "test@example.com" } },
  }),
  signOut: jest.fn(),
}));

jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn().mockResolvedValue({}),
}));

jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({
    foreground: "#000",
    muted: "#666",
    primary: "#4f46e5",
    accentForeground: "#fff",
  }),
}));

const mockDashboard = {
  summary: {
    revenue: 0,
    revenuePaidCount: 0,
    paidTotal: 0,
    navFailedCount: 0,
    outstanding: 1000,
    overdueTotal: 250,
    issuedTotal: 0,
    estimatedVat: 0,
    overdueCount: 1,
    oldestOverdueDays: 0,
    recentInvoices: [] as unknown[],
  },
  draftCount: 0,
  outstandingCount: 4,
  paidCount: 0,
  loading: false,
  error: null,
  refresh: jest.fn(),
};
jest.mock("@/hooks/useDashboardSummary", () => ({
  useDashboardSummary: () => mockDashboard,
}));

jest.mock("@/components/dashboard/M2mDemoCard", () => ({ M2mDemoCard: () => null }));
jest.mock("@/components/dashboard/NextActionsCard", () => ({
  NextActionsCard: () => {
    const { View } = require("react-native");
    return <View testID="dashboard-next-steps" />;
  },
}));
jest.mock("@/components/dashboard/RecentInvoices", () => ({ RecentInvoices: () => null }));

jest.mock("@/components/layout/ScreenLayout", () => ({
  ScreenLayout: ({ header, children }: { header?: React.ReactNode; children?: React.ReactNode }) => (
    <>
      {header}
      {children}
    </>
  ),
}));

const mockUi = require("@/__tests__/mocks/gluestack-ui");
jest.mock("@/components/ui/box", () => mockUi);
jest.mock("@/components/ui/vstack", () => mockUi);
jest.mock("@/components/ui/hstack", () => mockUi);
jest.mock("@/components/ui/card", () => mockUi);
jest.mock("@/components/ui/text", () => mockUi);
jest.mock("@/components/ui/pressable", () => mockUi);
jest.mock("@/components/ui/badge", () => mockUi);
jest.mock("@/components/ui/button", () => ({
  Button: mockUi.Button,
  ButtonText: mockUi.ButtonText,
  ButtonSpinner: mockUi.View,
}));
jest.mock("@/components/ui/heading", () => ({ Heading: mockUi.Heading }));

// Deferred `require` (not a static `import`): a static `import` here would be
// hoisted above the `const mockUi = require(...)` line above (ES import
// hoisting runs before any other top-level statement), so the screen's
// transitive `@/components/ui/button` etc. imports would resolve their mock
// factories while `mockUi` is still undefined.
const DashboardScreen = require("@/app/(app)/dashboard/index").default;

function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<DashboardScreen />);
  });
  return renderer;
}

function measure(renderer: TestRenderer.ReactTestRenderer, width: number) {
  const node = renderer.root.findAll(
    (n) => n.props.testID === "dashboard-top-row" && typeof n.props.onLayout === "function",
  )[0];
  expect(node).toBeTruthy();
  act(() => {
    node.props.onLayout({ nativeEvent: { layout: { width, height: 400, x: 0, y: 0 } } });
  });
}

function ids(renderer: TestRenderer.ReactTestRenderer, within: string) {
  const root = renderer.root.findAll((n) => n.props.testID === within)[0];
  return root ? root.findAll((n) => typeof n.props.testID === "string").map((n) => n.props.testID as string) : [];
}

describe("Főoldal top row layout", () => {
  it("container >= 1100: next steps is the third column of the top row", () => {
    const renderer = render();
    measure(renderer, 1110);
    const grid = ids(renderer, "dashboard-grid");
    expect(grid).toContain("dashboard-col-outstanding");
    expect(grid).toContain("dashboard-stat-received");
    expect(grid).toContain("dashboard-stat-vat");
    expect(grid).toContain("dashboard-col-next-steps");
    expect(grid).toContain("dashboard-next-steps");
  });

  it("container < 1100: next steps stays outside the top grid, as before", () => {
    const renderer = render();
    measure(renderer, 1099);
    const grid = ids(renderer, "dashboard-grid");
    expect(grid).toContain("dashboard-stat-received");
    expect(grid).not.toContain("dashboard-col-next-steps");
    expect(grid).not.toContain("dashboard-next-steps");
    expect(renderer.root.findAll((n) => n.props.testID === "dashboard-next-steps")).not.toHaveLength(0);
  });

  it("not yet measured: renders the narrow layout", () => {
    const renderer = render();
    expect(ids(renderer, "dashboard-grid")).not.toContain("dashboard-col-next-steps");
  });
});
