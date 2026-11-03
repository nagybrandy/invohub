// components/dashboard/RecentInvoices.test.tsx
// "Legutóbbi számlák" (SPEC §7.1): the title and the "Összes" link sit outside
// the box that holds the list; the empty and loading states render.
import TestRenderer, { act } from "react-test-renderer";
import { RecentInvoices } from "@/components/dashboard/RecentInvoices";
import type { Invoice } from "@/lib/invoices/types";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "hu" } }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/components/invoices/InvoiceCard", () => {
  const { View } = require("react-native");
  return { InvoiceCard: ({ invoice }: { invoice: Invoice }) => <View testID={`card-${invoice.id}`} /> };
});
jest.mock("@/components/invoices/InvoiceListTable", () => ({ InvoiceListTable: () => null }));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/heading", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));

const noop = () => undefined;

function render(props: Partial<React.ComponentProps<typeof RecentInvoices>> = {}) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <RecentInvoices invoices={[]} onOpenInvoice={noop} onOpenAll={noop} onDelete={noop} {...props} />,
    );
  });
  return tree;
}

const hosts = (tree: TestRenderer.ReactTestRenderer, testID: string) =>
  tree.root.findAll((n) => n.props.testID === testID && typeof n.type === "string");

describe("RecentInvoices", () => {
  it("shows the empty text when there are no invoices", () => {
    const tree = render();
    expect(JSON.stringify(tree.toJSON())).toContain("dashboard.table.noInvoices");
  });

  it("shows a skeleton, not the empty text, while loading", () => {
    const tree = render({ loading: true });
    expect(hosts(tree, "dashboard-recent-loading")).toHaveLength(1);
    expect(JSON.stringify(tree.toJSON())).not.toContain("dashboard.table.noInvoices");
  });

  it("renders a card per invoice on a narrow container", () => {
    const tree = render({ invoices: [{ id: "a" } as Invoice, { id: "b" } as Invoice] });
    expect(hosts(tree, "card-a")).toHaveLength(1);
    expect(hosts(tree, "card-b")).toHaveLength(1);
  });

  it("keeps the title and the Összes link outside the list box and opens the list", () => {
    const onOpenAll = jest.fn();
    const tree = render({ onOpenAll });
    const link = hosts(tree, "dashboard-recent-all")[0];
    // The list box is the node that gets the layout handler; the link is not inside it.
    const box = tree.root.find((n) => typeof n.props.onLayout === "function" && typeof n.type === "string");
    expect(box.findAll((n) => n.props.testID === "dashboard-recent-all")).toHaveLength(0);
    act(() => {
      let node: TestRenderer.ReactTestInstance | null = link;
      while (node && typeof node.props.onPress !== "function") node = node.parent;
      node!.props.onPress();
    });
    expect(onOpenAll).toHaveBeenCalled();
    expect(JSON.stringify(tree.toJSON())).toContain("dashboard.recentInvoices");
  });
});
