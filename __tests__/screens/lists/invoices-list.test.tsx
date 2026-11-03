// __tests__/screens/lists/invoices-list.test.tsx
// /invoices (redesign 2026-11): the KPI strip with the real summary values,
// the Lejárt cell applying the overdue filter, ÁFA staying a plain cell, the
// NAV alert only when useNavFailedCount() > 0 and "Megnézem" applying the
// navFailed filter, and the Új számla button in the header.
import TestRenderer, { act } from "react-test-renderer";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1200, height: 800, scale: 1, fontScale: 1 }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  useGlobalSearchParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => "/invoices"),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
    i18n: { language: "hu", changeLanguage: jest.fn() },
  }),
}));
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/lib/useColorScheme", () => ({
  useColorScheme: () => ({ isDarkColorScheme: false, toggleTheme: jest.fn() }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", faint: "#999", primary: "#36c", ok: "#0a0", destructive: "#c00" }),
}));
jest.mock("@/lib/api/client", () => ({
  apiFetch: jest.fn(),
  ApiError: class ApiError extends Error {},
  invoicePdfUrl: (id: string) => `/api/invoices/${id}/pdf`,
}));
jest.mock("@/lib/ui/use-measured-width", () => ({
  useMeasuredWidth: () => ({ width: mockContainerWidth, measured: true, onLayout: jest.fn() }),
}));

let mockContainerWidth = 1200;
let mockNavFailed = 0;
const mockUseInvoices = jest.fn();
jest.mock("@/hooks/useInvoices", () => ({ useInvoices: (...args: unknown[]) => mockUseInvoices(...args) }));
jest.mock("@/hooks/useInvoiceStatusCounts", () => ({
  useInvoiceStatusCounts: () => ({
    counts: { draft: 2, sent: 3, unpaid: 1, overdue: 4, paid: 9 },
    allCount: 19,
    other: 0,
    loading: false,
  }),
}));
jest.mock("@/hooks/useNavFailedCount", () => ({
  useNavFailedCount: () => ({ count: mockNavFailed, loading: false }),
}));
jest.mock("@/hooks/useMissingExchangeRateCount", () => ({
  useMissingExchangeRateCount: () => ({ count: 0, loading: false }),
}));
jest.mock("@/hooks/useDashboardSummary", () => ({
  useDashboardSummary: () => ({
    summary: {
      revenue: 500000,
      revenuePaidCount: 3,
      paidTotal: 500000,
      navFailedCount: 0,
      outstanding: 1200000,
      overdueTotal: 300000,
      issuedTotal: 0,
      estimatedVat: 81000,
      overdueCount: 2,
      oldestOverdueDays: 12,
      recentInvoices: [],
    },
    outstandingCount: 5,
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

jest.mock("@/components/layout/ScreenLayout", () => ({
  ScreenLayout: ({ header, children }: { header?: unknown; children?: unknown }) => {
    const { View } = require("react-native");
    return (
      <View>
        {header as never}
        {children as never}
      </View>
    );
  },
}));
jest.mock("@/components/ui/sheet", () => ({ Sheet: () => null }));
jest.mock("@/components/ui/select", () => ({ Select: () => null }));
jest.mock("@/components/layout/OverflowMenu", () => ({ OverflowMenu: () => null }));
const mockUi = require("@/__tests__/mocks/gluestack-ui");
jest.mock("@/components/ui/box", () => mockUi);
jest.mock("@/components/ui/vstack", () => mockUi);
jest.mock("@/components/ui/hstack", () => mockUi);
jest.mock("@/components/ui/card", () => mockUi);
jest.mock("@/components/ui/text", () => mockUi);
jest.mock("@/components/ui/pressable", () => mockUi);
jest.mock("@/components/ui/heading", () => ({ Heading: mockUi.Text }));
jest.mock("@/components/ui/button", () => ({
  Button: mockUi.Pressable,
  ButtonText: mockUi.Text,
  ButtonSpinner: mockUi.View,
}));
jest.mock("@/components/ui/input", () => ({ Input: mockUi.View, InputField: mockUi.Text }));

// Required after the mocks above (imports would hoist above `mockUi`).
const InvoiceListScreen = require("@/app/(app)/invoices/index").default as React.ComponentType;

const mounted: TestRenderer.ReactTestRenderer[] = [];

function render() {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<InvoiceListScreen />);
  });
  mounted.push(tree!);
  return tree!;
}

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount();
  });
  jest.useRealTimers();
});

function press(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const node = tree.root.findByProps({ testID });
  act(() => {
    (node.props.onPress as () => void)();
  });
}

function lastUseInvoicesArgs() {
  return mockUseInvoices.mock.calls[mockUseInvoices.mock.calls.length - 1][0] as Record<string, unknown>;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockContainerWidth = 1200;
  mockNavFailed = 0;
  mockPush.mockClear();
  mockUseInvoices.mockReset();
  mockUseInvoices.mockReturnValue({
    invoices: [makeInvoice()],
    total: 1,
    loading: false,
    error: null,
    refresh: jest.fn(),
    remove: jest.fn(),
    hasMore: false,
    loadMore: jest.fn(),
    loadingMore: false,
    convertedProformaIds: {},
  });
});

describe("/invoices screen", () => {
  it("has the Új számla button in the header, linking to the composer", () => {
    const tree = render();
    press(tree, "invoice-list-new");
    expect(mockPush).toHaveBeenCalledWith("/invoices/new");
  });

  it("shows four KPI cells with the real summary values (Fizetve labelled with the current month)", () => {
    const tree = render();
    const text = JSON.stringify(tree.toJSON());
    for (const label of ["lists.kpi.outstanding", "lists.kpi.overdue", "lists.kpi.paid", "lists.kpi.vat"]) {
      expect(text).toContain(label);
    }
    expect(text).toContain("lists.kpi.invoiceCount");
    // Fizetve's sub label is the current month, not a quarter.
    expect(text).toMatch(/\d{4}\./);
  });

  it("applies the overdue filter when Lejárt is clicked, and leaves ÁFA non-interactive", () => {
    const tree = render();
    expect(lastUseInvoicesArgs().status).toBe("all");
    press(tree, "kpi-strip-overdue");
    expect(lastUseInvoicesArgs().status).toBe("overdue");
    expect(tree.root.findByProps({ testID: "kpi-strip-vat" }).props.onPress).toBeUndefined();
    expect(tree.root.findByProps({ testID: "kpi-strip-outstanding" }).props.onPress).toBeUndefined();
  });

  it("applies the paid filter when Fizetve is clicked", () => {
    const tree = render();
    press(tree, "kpi-strip-paid");
    expect(lastUseInvoicesArgs().status).toBe("paid");
  });

  it("hides the NAV alert when no invoice failed NAV", () => {
    const tree = render();
    expect(tree.root.findAllByProps({ testID: "nav-alert-banner" })).toHaveLength(0);
  });

  it("shows the NAV alert when useNavFailedCount() > 0 and Megnézem filters to NAV-failed", () => {
    mockNavFailed = 2;
    const tree = render();
    expect(tree.root.findAllByProps({ testID: "nav-alert-banner" }).length).toBeGreaterThan(0);
    expect(lastUseInvoicesArgs().navFailed).toBe(false);
    press(tree, "nav-alert-show");
    expect(lastUseInvoicesArgs().navFailed).toBe(true);
    expect(lastUseInvoicesArgs().status).toBe("all");
  });

  it("shows status tabs with real counts on wide containers and the filter button on narrow ones", () => {
    let tree = render();
    expect(tree.root.findAllByProps({ testID: "status-tabs" }).length).toBeGreaterThan(0);
    expect(JSON.stringify(tree.toJSON())).toContain("19");
    expect(tree.root.findAllByProps({ testID: "invoice-list-filter-button" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: "invoice-list-export" }).length).toBeGreaterThan(0);
    act(() => mounted.pop()!.unmount());

    mockContainerWidth = 700;
    tree = render();
    expect(tree.root.findAllByProps({ testID: "status-tabs" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: "invoice-list-filter-button" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "invoice-list-export" })).toHaveLength(0);
  });
});
