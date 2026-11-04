// __tests__/screens/dashboard/dashboard-header.test.tsx
// (Colocating this under app/(app)/dashboard/ would make Expo Router treat
// it as a conflicting route, so it lives under __tests__/ instead, same as
// the other app-screen tests in __tests__/screens/.)
//
// Covers the Főoldal header and hero (redesign 2026-11, SPEC §7.1): the old
// "Bejövő számlák" button stays gone (AC1); the header carries NO create
// buttons and no quarter switcher at either width (AC2, the sidebar / tab bar
// own "Új számla" / "Új nyugta"); the to-do summary is real; and the unpaid /
// overdue lists stay reachable from the Kintlévőség card (AC3).
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
jest.mock("@/components/dashboard/NextActionsCard", () => ({ NextActionsCard: () => null }));
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

function press(renderer: TestRenderer.ReactTestRenderer, testID: string) {
  const node = renderer.root.findAll(
    (n) => n.props.testID === testID && typeof n.props.onPress === "function",
  )[0];
  expect(node).toBeTruthy();
  act(() => {
    node.props.onPress();
  });
}

function setCounts(counts: { navFailed: number; overdue: number; drafts: number }) {
  mockDashboard.summary.navFailedCount = counts.navFailed;
  mockDashboard.summary.overdueCount = counts.overdue;
  mockDashboard.draftCount = counts.drafts;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDashboard.summary.outstanding = 1000;
  mockDashboard.summary.overdueTotal = 250;
  mockDashboard.outstandingCount = 4;
  setCounts({ navFailed: 0, overdue: 1, drafts: 0 });
});

describe("Főoldal header", () => {
  it("AC1: renders no dashboard-incoming-invoices node and no dashboard.incomingInvoices text", () => {
    const renderer = render();

    expect(renderer.root.findAllByProps({ testID: "dashboard-incoming-invoices" })).toHaveLength(0);
    expect(() => renderer.root.findByProps({ children: "dashboard.incomingInvoices" })).toThrow();
  });

  it("AC2: has no create buttons and no quarter switcher", () => {
    const renderer = render();
    const json = JSON.stringify(renderer.toJSON());

    expect(renderer.root.findAllByProps({ testID: "dashboard-new-invoice" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: "dashboard-new-receipt" })).toHaveLength(0);
    expect(json).not.toContain("dashboard.newInvoice");
    expect(json).not.toContain("dashboard.newReceipt");
    // Nothing in the header is interactive (support is unconfigured here), so no
    // quarter switcher either: the summary API has no period parameter.
    const header = renderer.root.findByProps({ testID: "dashboard-header" });
    expect(header.findAll((n) => typeof n.props.onPress === "function")).toHaveLength(0);
  });

  it("shows the real to-do summary: cards present and how many are urgent", () => {
    setCounts({ navFailed: 2, overdue: 5, drafts: 3 });
    const json = JSON.stringify(render().toJSON());
    expect(json).toContain('home.summary.todoLead:{\\"count\\":3}');
    expect(json).toContain('home.summary.todoRest:{\\"urgent\\":1}');
  });

  it("says everything is done when no card is present", () => {
    setCounts({ navFailed: 0, overdue: 0, drafts: 0 });
    const json = JSON.stringify(render().toJSON());
    expect(json).toContain("home.summary.allDone");
    expect(json).not.toContain("home.summary.todoLead");
  });

  it("does not claim anything is done while the numbers are still loading", () => {
    setCounts({ navFailed: 0, overdue: 0, drafts: 0 });
    mockDashboard.loading = true;
    try {
      const json = JSON.stringify(render().toJSON());
      expect(json).not.toContain("home.summary.allDone");
    } finally {
      mockDashboard.loading = false;
    }
  });
});

describe("Főoldal Kintlévőség card", () => {
  it("AC3: the not-due segment and legend row open the unpaid list, the overdue ones the overdue list", () => {
    const renderer = render();

    press(renderer, "dashboard-outstanding-segment-not-due");
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/invoices", params: { status: "unpaid" } });
    press(renderer, "dashboard-outstanding-legend-not-due");
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/invoices", params: { status: "unpaid" } });

    press(renderer, "dashboard-outstanding-segment-overdue");
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/invoices", params: { status: "overdue" } });
    press(renderer, "dashboard-outstanding-legend-overdue");
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: "/invoices", params: { status: "overdue" } });
  });

  it("sizes the bar segments by not-due vs overdue amount", () => {
    const renderer = render();
    const grow = (testID: string) =>
      renderer.root.findAll((n) => n.props.testID === testID && n.props.style)[0].props.style.flexGrow;
    expect(grow("dashboard-outstanding-segment-not-due")).toBeCloseTo(0.75, 5);
    expect(grow("dashboard-outstanding-segment-overdue")).toBeCloseTo(0.25, 5);
  });

  it("shows the unpaid invoice count", () => {
    const json = JSON.stringify(render().toJSON());
    expect(json).toContain('home.outstanding.unpaidCount:{\\"count\\":4}');
  });

  it("draws no segments when nothing is outstanding", () => {
    mockDashboard.summary.outstanding = 0;
    mockDashboard.summary.overdueTotal = 0;
    mockDashboard.outstandingCount = 0;
    const renderer = render();
    expect(renderer.root.findAllByProps({ testID: "dashboard-outstanding-segment-not-due" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: "dashboard-outstanding-segment-overdue" })).toHaveLength(0);
  });

  it("renders the two stat cards: payments received and the estimated VAT with its info tooltip", () => {
    const renderer = render();
    const json = JSON.stringify(renderer.toJSON());
    expect(json).toContain("home.stats.received");
    expect(json).toContain("dashboard.kpi.estimatedVat");
    expect(renderer.root.findAllByProps({ testID: "dashboard-stat-vat-info" }).length).toBeGreaterThan(0);
  });
});
