// __tests__/screens/dashboard/dashboard-header.test.tsx
// (Colocating this under app/(app)/dashboard/ would make Expo Router treat
// it as a conflicting route, so it lives under __tests__/ instead, same as
// the other app-screen tests in __tests__/screens/.)
//
// Covers the dashboard header's primary action: desktop must no longer show
// the mislabelled "Bejövő számlák" (incoming invoices) button that actually
// opened the *outgoing* unpaid list (AC1); mobile's "Új számla" button must
// keep working unchanged (AC2); and the unpaid list must stay reachable at
// both widths via the "Kintlévőség" KPI card (AC3).
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), replace: jest.fn(), back: jest.fn() },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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

const mockUseIsDesktop = jest.fn();
jest.mock("@/lib/useIsDesktop", () => ({
  useIsDesktop: () => mockUseIsDesktop(),
}));

jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({
    foreground: "#000",
    muted: "#666",
    primary: "#4f46e5",
    accentForeground: "#fff",
  }),
}));

jest.mock("@/hooks/useDashboardSummary", () => ({
  useDashboardSummary: () => ({
    summary: {
      revenue: 0,
      outstanding: 0,
      overdueTotal: 0,
      issuedTotal: 0,
      estimatedVat: 0,
      overdueCount: 0,
      oldestOverdueDays: 0,
      recentInvoices: [],
    },
    draftCount: 0,
    outstandingCount: 0,
    paidCount: 0,
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

// Not mocked, by design: PageHeader and StatCard are what's under test
// (AC1, AC3).
jest.mock("@/components/dashboard/M2mDemoCard", () => ({ M2mDemoCard: () => null }));
jest.mock("@/components/dashboard/NextActionsCard", () => ({ NextActionsCard: () => null }));
jest.mock("@/components/invoices/InvoiceListTable", () => ({ InvoiceListTable: () => null }));
jest.mock("@/components/invoices/InvoiceCard", () => ({ InvoiceCard: () => null }));

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
const { StatCard } = require("@/components/layout/StatCard");

function render(isDesktop: boolean) {
  mockUseIsDesktop.mockReturnValue(isDesktop);
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<DashboardScreen />);
  });
  return renderer;
}

describe("dashboard header — incoming-invoices button removal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("AC1: desktop renders no dashboard-incoming-invoices node and no dashboard.incomingInvoices text", () => {
    const renderer = render(true);

    expect(renderer.root.findAllByProps({ testID: "dashboard-incoming-invoices" })).toHaveLength(0);
    expect(() => renderer.root.findByProps({ children: "dashboard.incomingInvoices" })).toThrow();
  });

  it("AC2: mobile still renders the dashboard.newInvoice button, and pressing it pushes routes.newInvoice", () => {
    const renderer = render(false);

    const buttonText = renderer.root.findByProps({ children: "dashboard.newInvoice" });
    expect(buttonText).toBeTruthy();

    // Walk up to the nearest ancestor with an onPress (the Button/Pressable).
    let node: TestRenderer.TestInstance | null = buttonText;
    while (node && typeof node.props.onPress !== "function") {
      node = node.parent;
    }
    expect(node).toBeTruthy();
    act(() => {
      node!.props.onPress();
    });

    expect(mockPush).toHaveBeenCalledWith("/invoices/new");
  });

  it("AC3: pressing the dashboard.kpi.outstanding StatCard pushes the filtered unpaid list (desktop)", () => {
    const renderer = render(true);
    assertOutstandingCardNavigates(renderer);
  });

  it("AC3: pressing the dashboard.kpi.outstanding StatCard pushes the filtered unpaid list (mobile)", () => {
    const renderer = render(false);
    assertOutstandingCardNavigates(renderer);
  });
});

function assertOutstandingCardNavigates(renderer: TestRenderer.ReactTestRenderer) {
  const cards = renderer.root.findAllByType(StatCard);
  const outstandingCard = cards.find((c) => c.props.label === "dashboard.kpi.outstanding");
  expect(outstandingCard).toBeTruthy();

  act(() => {
    outstandingCard!.props.onPress();
  });

  expect(mockPush).toHaveBeenCalledWith({ pathname: "/invoices", params: { status: "unpaid" } });
}
