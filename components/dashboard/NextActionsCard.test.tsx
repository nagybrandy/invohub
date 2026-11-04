// components/dashboard/NextActionsCard.test.tsx
// "Következő lépések" (SPEC §7.1): only cards backed by real data (NAV error,
// overdue, drafts) with a matching count badge, or one all-clear card; no NAV
// resubmit and no reminder-send button anywhere.
import TestRenderer, { act } from "react-test-renderer";
import { NextActionsCard, cardColumns } from "@/components/dashboard/NextActionsCard";
import type { Invoice } from "@/lib/invoices/types";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", primary: "#4f46e5", destructive: "#dc2626", warn: "#8a5200", ok: "#1b7a4f" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/button", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/card", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/heading", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));

type Options = { status?: string; navFailed?: boolean; pageSize?: number };
const mockUseInvoices = jest.fn((options: Options) => ({ invoices: lookup(options), loading: false }));
jest.mock("@/hooks/useInvoices", () => ({
  useInvoices: (options: Options) => mockUseInvoices(options),
}));

function inv(id: string, overrides: Partial<Invoice> = {}): Invoice {
  return {
    id,
    invoiceNumber: `INV-2026-0000${id}`,
    clientName: `Partner ${id}`,
    status: "sent",
    currency: "HUF",
    dueDate: "2026-10-01",
    issueDate: "2026-09-20",
    lineItems: [{ id: "l", description: "x", quantity: 1, unitPrice: 1000, vatRate: 27, vatCategory: "normal" }],
    ...overrides,
  } as Invoice;
}

let data: { nav: Invoice[]; overdue: Invoice[]; drafts: Invoice[] };

function lookup(options: Options): Invoice[] {
  if (options.navFailed) return data.nav;
  if (options.status === "overdue") return data.overdue;
  if (options.status === "draft") return data.drafts;
  return [];
}

beforeEach(() => {
  jest.clearAllMocks();
  data = {
    nav: [inv("1", { clientName: "Nordic Trade Bt." })],
    overdue: [inv("2", { status: "overdue", clientName: "Budapest Bistro Kft.", dueDate: "2020-01-01" }), inv("3", { status: "overdue" })],
    drafts: [inv("4", { status: "draft", invoiceNumber: "" }), inv("5", { status: "draft", invoiceNumber: "", clientName: "" })],
  };
});

type Props = React.ComponentProps<typeof NextActionsCard>;

function renderCard(props: Partial<Props> = {}) {
  const full: Props = {
    navFailedCount: 0,
    overdueCount: 0,
    overdueTotal: 0,
    draftCount: 0,
    onSelect: jest.fn(),
    onOpenInvoice: jest.fn(),
    ...props,
  };
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<NextActionsCard {...full} />);
  });
  return { tree, props: full };
}

/** The host nodes with this testID. */
const hosts = (tree: TestRenderer.ReactTestRenderer, testID: string) =>
  tree.root.findAll((n) => n.props.testID === testID && typeof n.type === "string");

/** What pressing the node does: the closest ancestor (or itself) with an onPress. */
function pressTarget(host: TestRenderer.ReactTestInstance) {
  let node: TestRenderer.ReactTestInstance | null = host;
  while (node && typeof node.props.onPress !== "function") node = node.parent;
  if (!node) throw new Error("nothing pressable");
  return node;
}
const press = (tree: TestRenderer.ReactTestRenderer, testID: string, index = 0) =>
  act(() => {
    pressTarget(hosts(tree, testID)[index]).props.onPress();
  });

function collectText(node: TestRenderer.ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return node.children.map(collectText).join("");
}
const textOf = (tree: TestRenderer.ReactTestRenderer, testID: string) => collectText(hosts(tree, testID)[0]);

describe("NextActionsCard", () => {
  it("shows one all-clear card and no badge when there is nothing to do", () => {
    const { tree } = renderCard();
    expect(tree.root.findAllByProps({ testID: "next-actions-all-clear" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "next-actions-count" })).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain("home.nextSteps.allClear.title");
  });

  it("does not query any invoices when there is nothing to do", () => {
    renderCard();
    expect(mockUseInvoices).not.toHaveBeenCalled();
  });

  it("renders only the cards whose count is above zero, with a matching count badge", () => {
    const { tree } = renderCard({ overdueCount: 2, overdueTotal: 228600, draftCount: 5 });
    expect(tree.root.findAllByProps({ testID: "next-step-nav" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: "next-step-overdue" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "next-step-drafts" }).length).toBeGreaterThan(0);
    expect(textOf(tree, "next-actions-count")).toContain("2");
    expect(tree.root.findAllByProps({ testID: "next-actions-all-clear" })).toHaveLength(0);
  });

  it("renders all three cards, NAV first, and the badge says 3", () => {
    const { tree } = renderCard({ navFailedCount: 1, overdueCount: 2, overdueTotal: 1, draftCount: 2 });
    const order = tree.root
      .findAll((n) => ["next-step-nav", "next-step-overdue", "next-step-drafts"].includes(n.props.testID as string))
      .map((n) => n.props.testID);
    expect([...new Set(order)]).toEqual(["next-step-nav", "next-step-overdue", "next-step-drafts"]);
    expect(textOf(tree, "next-actions-count")).toContain("3");
  });

  it("loads at most three invoices per card with the matching filter", () => {
    renderCard({ navFailedCount: 1, overdueCount: 2, overdueTotal: 1, draftCount: 2 });
    expect(mockUseInvoices).toHaveBeenCalledWith({ navFailed: true, pageSize: 3 });
    expect(mockUseInvoices).toHaveBeenCalledWith({ status: "overdue", pageSize: 3 });
    expect(mockUseInvoices).toHaveBeenCalledWith({ status: "draft", pageSize: 3 });
  });

  it("shows neither cards nor the all-clear card while loading", () => {
    const { tree } = renderCard({ navFailedCount: 1, loading: true });
    expect(tree.root.findAllByProps({ testID: "next-step-nav" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: "next-actions-all-clear" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: "next-actions-loading" }).length).toBeGreaterThan(0);
  });
});

describe("NextActionsCard — NAV error card", () => {
  it("lists the failed invoice and opens it with Megnyitás", () => {
    const { tree, props } = renderCard({ navFailedCount: 1 });
    expect(JSON.stringify(tree.toJSON())).toContain("INV-2026-00001 · Nordic Trade Bt.");
    press(tree, "next-step-nav-open");
    expect(props.onOpenInvoice).toHaveBeenCalledWith("1");
  });

  it("'Mind megnézem' opens the NAV-failed list", () => {
    const { tree, props } = renderCard({ navFailedCount: 3 });
    press(tree, "next-step-nav-all");
    expect(props.onSelect).toHaveBeenCalledWith("navFailed");
  });

  it("has no NAV resubmit and no reminder button anywhere (SPEC §11)", () => {
    const { tree } = renderCard({ navFailedCount: 1, overdueCount: 2, overdueTotal: 5, draftCount: 1 });
    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toMatch(/resubmit|retry|reminder|remind/i);
    expect(json).not.toContain("Újraküldés");
    expect(json).not.toContain("Emlékeztető");
  });
});

describe("NextActionsCard — overdue card", () => {
  it("shows the total, each overdue invoice with its age, and opens an invoice on tap", () => {
    const { tree, props } = renderCard({ overdueCount: 2, overdueTotal: 228600 });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Budapest Bistro Kft.");
    expect(json).toContain("home.nextSteps.overdue.daysAgo");
    expect(json).toMatch(/228.?600/);
    expect(hosts(tree, "next-step-overdue-row")).toHaveLength(2);
    press(tree, "next-step-overdue-row");
    expect(props.onOpenInvoice).toHaveBeenCalledWith("2");
  });

  it("'Lejártak megnyitása' opens the overdue list", () => {
    const { tree, props } = renderCard({ overdueCount: 2, overdueTotal: 1 });
    press(tree, "next-step-overdue-open");
    expect(props.onSelect).toHaveBeenCalledWith("overdue");
  });

  it("rows are at least 40px tall tap targets", () => {
    const { tree } = renderCard({ overdueCount: 2, overdueTotal: 1 });
    expect(String(hosts(tree, "next-step-overdue-row")[0].props.className)).toMatch(/min-h-10/);
  });
});

describe("NextActionsCard — drafts card", () => {
  it("lists drafts, falling back to a label for a draft without a partner", () => {
    const { tree } = renderCard({ draftCount: 2 });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Partner 4");
    expect(json).toContain("home.nextSteps.drafts.untitled");
  });

  it("'Piszkozatok megnyitása' opens the drafts list", () => {
    const { tree, props } = renderCard({ draftCount: 2 });
    press(tree, "next-step-drafts-open");
    expect(props.onSelect).toHaveBeenCalledWith("draft");
  });
});

describe("cardColumns", () => {
  it("fits as many 270px cards as the container allows, up to three", () => {
    expect(cardColumns(0)).toBe(1);
    expect(cardColumns(300)).toBe(1);
    expect(cardColumns(554)).toBe(2);
    expect(cardColumns(740)).toBe(2);
    expect(cardColumns(837)).toBe(2);
    expect(cardColumns(838)).toBe(3);
    expect(cardColumns(1112)).toBe(3);
  });
});
