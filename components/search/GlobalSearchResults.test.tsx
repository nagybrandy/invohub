// components/search/GlobalSearchResults.test.tsx
// Global search results (SPEC §7.2), native container: nothing under two
// characters, a 250ms debounce, data only from the existing hooks, groups
// Számlák / Partnerek / Termékek with at most five rows each, the match
// highlighted, an empty state, and a press opens the row and closes the field.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { GlobalSearchResults } from "@/components/search/GlobalSearchResults";
import type { Invoice } from "@/lib/invoices/types";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
    i18n: { language: "hu" },
  }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/lib/theme/icon-colors", () => ({ useIconColors: () => ({ muted: "#666" }) }));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));

const mockUseInvoices = jest.fn();
const mockUseClients = jest.fn();
const mockUseProducts = jest.fn();
jest.mock("@/hooks/useInvoices", () => ({ useInvoices: (o: unknown) => mockUseInvoices(o) }));
jest.mock("@/hooks/useClients", () => ({ useClients: () => mockUseClients() }));
jest.mock("@/hooks/useProducts", () => ({ useProducts: () => mockUseProducts() }));

function inv(id: string, number: string, client: string): Invoice {
  return {
    id,
    invoiceNumber: number,
    clientName: client,
    issueDate: "2026-11-01",
    dueDate: "2026-11-09",
    status: "sent",
    currency: "HUF",
    lineItems: [{ id: "l", description: "x", quantity: 1, unitPrice: 1000, vatRate: 27, vatCategory: "normal" }],
  } as Invoice;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockUseInvoices.mockReturnValue({
    invoices: [inv("i1", "INV-2026-00017", "Nordic Trade Bt.")],
    loading: false,
  });
  mockUseClients.mockReturnValue({
    clients: [
      { id: "c1", name: "Nordic Trade Bt.", taxNumber: "46789901-2-17", city: "Győr" },
      { id: "c2", name: "Pixel Műhely Kft." },
    ],
    loading: false,
  });
  mockUseProducts.mockReturnValue({
    products: [{ id: "p1", name: "Nordic webdesign", unitPrice: 50000, currency: "HUF" }],
    loading: false,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

function render(query: string, onClose = jest.fn(), variant: "popover" | "panel" = "popover") {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<GlobalSearchResults query={query} onClose={onClose} variant={variant} />);
  });
  const setQuery = (next: string) =>
    act(() => {
      tree.update(<GlobalSearchResults query={next} onClose={onClose} variant={variant} />);
    });
  const settle = () =>
    act(() => {
      jest.advanceTimersByTime(250);
    });
  return { tree, onClose, setQuery, settle };
}

const hosts = (tree: TestRenderer.ReactTestRenderer, testID: string) =>
  tree.root.findAll((n) => n.props.testID === testID && typeof n.type === "string");

function collect(node: TestRenderer.ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return node.children.map(collect).join("");
}

describe("GlobalSearchResults", () => {
  it("shows nothing and fetches nothing for an empty or one-character query", () => {
    const { tree, settle } = render("");
    settle();
    expect(tree.toJSON()).toBeNull();
    const one = render("n");
    one.settle();
    expect(one.tree.toJSON()).toBeNull();
    expect(mockUseInvoices).not.toHaveBeenCalled();
    expect(mockUseClients).not.toHaveBeenCalled();
    expect(mockUseProducts).not.toHaveBeenCalled();
  });

  it("waits 250ms after the last keystroke before searching", () => {
    const { tree, setQuery } = render("");
    setQuery("no");
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(tree.toJSON()).toBeNull();
    expect(mockUseInvoices).not.toHaveBeenCalled();
    setQuery("nor");
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(tree.toJSON()).toBeNull();
    act(() => {
      jest.advanceTimersByTime(60);
    });
    expect(tree.toJSON()).not.toBeNull();
    expect(mockUseInvoices).toHaveBeenCalledWith({ search: "nor", pageSize: 5 });
  });

  it("groups real results as Számlák, Partnerek, Termékek", () => {
    const { tree, settle } = render("nordic");
    settle();
    expect(hosts(tree, "global-search-group-invoices")).toHaveLength(1);
    expect(hosts(tree, "global-search-group-clients")).toHaveLength(1);
    expect(hosts(tree, "global-search-group-products")).toHaveLength(1);
    expect(collect(hosts(tree, "global-search-group-invoices")[0])).toContain("globalSearch.groups.invoices");
    expect(collect(hosts(tree, "global-search-group-invoices")[0])).toContain("INV-2026-00017");
    expect(collect(hosts(tree, "global-search-group-clients")[0])).toContain("46789901-2-17 · Győr");
    // Pixel does not match "nordic": filtered out locally.
    expect(collect(hosts(tree, "global-search-group-clients")[0])).not.toContain("Pixel");
    expect(collect(hosts(tree, "global-search-group-products")[0])).toContain("Nordic webdesign");
  });

  it("highlights the match in titles and sub lines", () => {
    const { tree, settle } = render("nordic");
    settle();
    const marks = hosts(tree, "search-match").map(collect);
    expect(marks.length).toBeGreaterThanOrEqual(3);
    expect(marks.every((m) => m.toLowerCase() === "nordic")).toBe(true);
  });

  it("shows at most five rows per group", () => {
    mockUseClients.mockReturnValue({
      clients: Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, name: `Nordic ${i}` })),
      loading: false,
    });
    const { tree, settle } = render("nordic");
    settle();
    const rows = hosts(tree, "global-search-result").filter((row) => collect(row).includes("Nordic "));
    expect(rows.filter((row) => /Nordic \d/.test(collect(row)))).toHaveLength(5);
  });

  it("shows the empty state naming the query when nothing matches", () => {
    mockUseInvoices.mockReturnValue({ invoices: [], loading: false });
    const { tree, settle } = render("zzz");
    settle();
    expect(collect(hosts(tree, "global-search-empty")[0])).toContain('globalSearch.noResults:{"query":"zzz"}');
  });

  it("shows a loading line, not the empty state, while the data loads", () => {
    mockUseInvoices.mockReturnValue({ invoices: [], loading: true });
    mockUseClients.mockReturnValue({ clients: [], loading: true });
    const { tree, settle } = render("zzz");
    settle();
    expect(hosts(tree, "global-search-loading")).toHaveLength(1);
    expect(hosts(tree, "global-search-empty")).toHaveLength(0);
  });

  it("opening a result closes the field and navigates to it", () => {
    const { tree, settle, onClose } = render("nordic");
    settle();
    const first = hosts(tree, "global-search-result")[0];
    let node: TestRenderer.ReactTestInstance | null = first;
    while (node && typeof node.props.onPress !== "function") node = node.parent;
    act(() => {
      node!.props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/invoices/i1");
  });

  it("hides at once when the query drops below two characters", () => {
    const { tree, settle, setQuery } = render("nordic");
    settle();
    expect(tree.toJSON()).not.toBeNull();
    setQuery("n");
    expect(tree.toJSON()).toBeNull();
  });

  it("the phone panel spans the field's width; the popover is 460px wide and right aligned", () => {
    const popover = render("nordic");
    popover.settle();
    expect(String(hosts(popover.tree, "global-search-results")[0].props.className)).toContain("w-[460px]");
    const panel = render("nordic", jest.fn(), "panel");
    panel.settle();
    expect(String(hosts(panel.tree, "global-search-results")[0].props.className)).toContain("left-0 right-0");
  });
});
