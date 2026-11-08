// __tests__/screens/recurring-invoices-list.test.tsx
// The Ismétlődő számlák list: row menu (pause / resume / edit / delete with
// confirm), empty state, and that it links to the edit route.
import TestRenderer, { act } from "react-test-renderer";
import RecurringInvoicesScreen from "@/app/(app)/invoices/recurring/index";
import type { RecurringTemplate } from "@/lib/recurring/service";

const mockPush = jest.fn();
const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockRemove = jest.fn().mockResolvedValue(undefined);
const mockConfirm = jest.fn();
let mockTemplates: RecurringTemplate[] = [];

jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn(), replace: jest.fn() } }));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key) }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/hooks/useRecurringInvoices", () => ({
  useRecurringInvoices: () => ({
    templates: mockTemplates,
    loading: false,
    error: null,
    refresh: jest.fn(),
    update: (...a: unknown[]) => mockUpdate(...a),
    remove: (...a: unknown[]) => mockRemove(...a),
  }),
}));
jest.mock("@/lib/ui/confirm", () => ({ confirmAsync: (...a: unknown[]) => mockConfirm(...a) }));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/layout/ScreenLayout", () => ({ ScreenLayout: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/components/layout/PageHeader", () => ({ PageHeader: () => null }));
jest.mock("@/components/layout/StateView", () => {
  const { View, Text } = require("react-native");
  return { StateView: ({ title, action }: { title?: string; action?: React.ReactNode }) => (
      <View testID="state-view">
        <Text>{title}</Text>
        {action}
      </View>
    ) };
});
jest.mock("@/components/lists/ListSearchField", () => ({ ListSearchField: () => null }));
jest.mock("@/components/lists/ListFooterBar", () => ({ ListFooterBar: () => null }));
jest.mock("@/components/lists/ListCardRow", () => ({ ListCardRow: () => null }));
jest.mock("@/components/recurring/RecurringStatusPill", () => ({ RecurringStatusPill: () => null }));
// Expose what the screen hands to the table / row menu.
jest.mock("@/components/layout/OverflowMenu", () => ({
  OverflowMenu: ({ items }: { items: unknown[] }) => {
    const { View } = require("react-native");
    return <View testID="row-menu" {...({ items } as object)} />;
  },
}));
jest.mock("@/components/lists/ListTable", () => ({
  ListTable: ({ rows, rowMenu, empty, onRowPress }: { rows: unknown[]; rowMenu: (r: unknown) => React.ReactNode; empty: React.ReactNode; onRowPress: (r: unknown) => void }) => {
    const { View } = require("react-native");
    return (
      <View testID="table" {...({ onRowPress } as object)}>
        {rows.length === 0 ? empty : rows.map((r, i) => <View key={i}>{rowMenu(r)}</View>)}
      </View>
    );
  },
}));

function template(overrides: Partial<RecurringTemplate> = {}): RecurringTemplate {
  return {
    id: "tpl-1",
    userId: "u",
    clientName: "Acme Kft.",
    currency: "HUF",
    paymentTermDays: 8,
    lineItems: [],
    frequency: "monthly",
    startDate: "2027-01-31",
    nextIndex: 0,
    nextRunDate: "2027-01-31",
    status: "active",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

function render() {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<RecurringInvoicesScreen />);
  });
  return tree!;
}

const menuItems = (tree: TestRenderer.ReactTestRenderer) =>
  tree.root.findByProps({ testID: "row-menu" }).props.items as { label: string; onPress: () => void; destructive?: boolean }[];

beforeEach(() => {
  jest.clearAllMocks();
  mockTemplates = [];
});

describe("Ismétlődő számlák list", () => {
  it("shows the empty state (outside any FlatList) with a way to the invoices", () => {
    const tree = render();
    expect(tree.root.findByProps({ testID: "state-view" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "recurring-empty-action" })).toBeTruthy();
  });

  it("active template: pause, edit, delete", () => {
    mockTemplates = [template()];
    const items = menuItems(render());
    expect(items.map((i) => i.label)).toEqual(["recurring.actions.pause", "recurring.actions.edit", "recurring.actions.delete"]);
    items[0].onPress();
    expect(mockUpdate).toHaveBeenCalledWith("tpl-1", { status: "paused" });
    items[1].onPress();
    expect(mockPush).toHaveBeenCalledWith("/invoices/recurring/tpl-1");
  });

  it("paused template offers resume; completed offers neither", () => {
    mockTemplates = [template({ status: "paused" })];
    const items = menuItems(render());
    expect(items[0].label).toBe("recurring.actions.resume");
    items[0].onPress();
    expect(mockUpdate).toHaveBeenCalledWith("tpl-1", { status: "active" });

    mockTemplates = [template({ status: "completed", nextRunDate: undefined })];
    expect(menuItems(render()).map((i) => i.label)).toEqual(["recurring.actions.edit", "recurring.actions.delete"]);
  });

  it("delete asks for confirmation and only deletes on yes", async () => {
    mockTemplates = [template()];
    const del = menuItems(render())[2];
    expect(del.destructive).toBe(true);

    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => del.onPress());
    expect(mockRemove).not.toHaveBeenCalled();

    mockConfirm.mockResolvedValueOnce(true);
    await act(async () => del.onPress());
    expect(mockRemove).toHaveBeenCalledWith("tpl-1");
  });
});
