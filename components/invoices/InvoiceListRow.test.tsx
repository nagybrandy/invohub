// components/invoices/InvoiceListRow.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { InvoiceListRow } from "@/components/invoices/InvoiceListRow";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
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

const now = new Date("2026-09-14T12:00:00.000Z");

function renderRow(props: React.ComponentProps<typeof InvoiceListRow>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<InvoiceListRow now={now} {...props} />);
  });
  return tree!;
}

describe("InvoiceListRow", () => {
  it("renders invoice number, partner, due date and gross amount", () => {
    const tree = renderRow({
      invoice: makeInvoice({ invoiceNumber: "INV-2026-010", currency: "HUF" }),
      menuItems: [],
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("INV-2026-010");
    expect(json).toContain("Acme Kft.");
  });

  it("shows the overdue subtext under the due date when the invoice is past due", () => {
    const invoice = makeInvoice({ status: "sent", dueDate: "2026-08-30" });
    const tree = renderRow({ invoice, menuItems: [] });
    const overdueNode = tree.root.findByProps({ testID: "invoice-row-overdue-label" });
    expect(JSON.stringify(overdueNode.props.children)).toContain("15");
  });

  it("does not show the overdue subtext for a paid invoice", () => {
    const invoice = makeInvoice({ status: "paid", dueDate: "2026-01-01" });
    const tree = renderRow({ invoice, menuItems: [] });
    expect(() => tree.root.findByProps({ testID: "invoice-row-overdue-label" })).toThrow();
  });

  it("calls onPress with the invoice when the row is tapped", () => {
    const onPress = jest.fn();
    const invoice = makeInvoice();
    const tree = renderRow({ invoice, onPress, menuItems: [] });
    const row = tree.root.findByProps({ testID: "invoice-list-row" });
    act(() => {
      row.props.onPress?.();
    });
    expect(onPress).toHaveBeenCalledWith(invoice);
  });

  it("shows a draft placeholder instead of an invoice number for unfinalized drafts", () => {
    const invoice = makeInvoice({ invoiceNumber: "", status: "draft" });
    const tree = renderRow({ invoice, menuItems: [] });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.status.draft");
  });

  it("passes the row menu items through to the overflow menu", () => {
    const onDelete = jest.fn();
    const invoice = makeInvoice();
    const tree = renderRow({
      invoice,
      menuItems: [{ label: "Törlés", onPress: onDelete, destructive: true }],
    });
    const trigger = tree.root.findByProps({ testID: "overflow-menu-trigger" });
    act(() => {
      trigger.props.onPress?.();
    });
    const item = tree.root.findByProps({ testID: "overflow-menu-item-0" });
    act(() => {
      item.props.onPress?.();
    });
    expect(onDelete).toHaveBeenCalled();
  });
});
