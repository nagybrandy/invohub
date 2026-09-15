// components/invoices/InvoiceListTable.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { InvoiceListTable } from "@/components/invoices/InvoiceListTable";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", primary: "#4f46e5", destructive: "#dc2626" }),
}));
jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");
  return new Proxy({}, { get: () => View });
});
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));

function render(props: React.ComponentProps<typeof InvoiceListTable>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<InvoiceListTable {...props} />);
  });
  return tree!;
}

describe("InvoiceListTable", () => {
  it("renders the required column headers", () => {
    const tree = render({
      invoices: [makeInvoice()],
      menuItemsFor: () => [],
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.list.columnNumber");
    expect(json).toContain("invoices.list.columnPartner");
    expect(json).toContain("invoices.list.columnIssued");
    expect(json).toContain("invoices.list.columnDue");
    expect(json).toContain("invoices.list.columnStatus");
    expect(json).toContain("NAV");
    expect(json).toContain("invoices.list.columnGross");
  });

  it("renders one InvoiceListRow per invoice", () => {
    const tree = render({
      invoices: [makeInvoice({ id: "a" }), makeInvoice({ id: "b", invoiceNumber: "INV-2026-002" })],
      menuItemsFor: () => [],
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("INV-2026-001");
    expect(json).toContain("INV-2026-002");
  });

  it("shows a sort indicator on the active sortable column and calls onSortChange", () => {
    const onSortChange = jest.fn();
    const tree = render({
      invoices: [makeInvoice()],
      menuItemsFor: () => [],
      sort: { key: "gross", direction: "desc" },
      onSortChange,
    });
    const header = tree.root.findByProps({ testID: "invoice-table-sort-gross" });
    act(() => {
      header.props.onPress?.();
    });
    expect(onSortChange).toHaveBeenCalledWith("gross");
  });

  it("renders the empty state when there are no invoices and not loading", () => {
    const tree = render({
      invoices: [],
      menuItemsFor: () => [],
      empty: <></>,
    });
    // No rows, no crash.
    expect(tree.root.findAllByProps({ testID: "invoice-list-row" })).toHaveLength(0);
  });

  it("renders a loading skeleton when loading with no invoices yet", () => {
    const tree = render({ invoices: [], loading: true, menuItemsFor: () => [] });
    expect(tree.root.findByProps({ testID: "state-view-loading" })).toBeTruthy();
  });
});
