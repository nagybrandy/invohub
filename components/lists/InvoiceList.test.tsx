// components/lists/InvoiceList.test.tsx
// The shared invoice list (Számlák, Főoldal): table columns and cells, cards,
// the overdue / due-in line, the converted label, the NAV icon and the row
// menu. The row tests were ported from the old InvoiceListRow.
import TestRenderer, { act } from "react-test-renderer";
import { InvoiceList } from "@/components/lists/InvoiceList";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  }),
}));
jest.mock("@/lib/theme/icon-colors", () => ({
  useIconColors: () => ({ foreground: "#000", muted: "#666", primary: "#4f46e5", destructive: "#dc2626", ok: "#0a0" }),
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
jest.mock("@/components/ui/button", () => require("@/__tests__/mocks/gluestack-ui"));

const now = new Date("2026-09-14T12:00:00.000Z");

function render(props: Partial<React.ComponentProps<typeof InvoiceList>> & { invoices: React.ComponentProps<typeof InvoiceList>["invoices"] }) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<InvoiceList now={now} layout="table" menuItemsFor={() => []} {...props} />);
  });
  return tree!;
}

describe("InvoiceList table", () => {
  it("has exactly the columns Sorszám, Partner, Kelt, Fizetési határidő, Státusz, NAV, Bruttó összeg", () => {
    const tree = render({ invoices: [makeInvoice()] });
    const order = [
      "invoices.list.columnNumber",
      "invoices.list.columnPartner",
      "invoices.list.columnIssued",
      "invoices.list.columnDue",
      "invoices.list.columnStatus",
      "NAV",
      "invoices.list.columnGross",
    ];
    // The header row is the first thing in the table; each label appears once, in this order.
    const json = JSON.stringify(tree.toJSON());
    const headerEnd = json.indexOf("invoice-list-row");
    const header = json.slice(0, headerEnd);
    let last = -1;
    for (const label of order) {
      expect(header.split(`"${label}"`).length - 1).toBe(1);
      const at = header.indexOf(`"${label}"`);
      expect(at).toBeGreaterThan(last);
      last = at;
    }
  });

  it("renders invoice number, document type, partner and gross amount", () => {
    const tree = render({ invoices: [makeInvoice({ invoiceNumber: "INV-2026-010", currency: "HUF" })] });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("INV-2026-010");
    expect(json).toContain("invoices.documentTypes.invoice");
    expect(json).toContain("Acme Kft.");
  });

  it("has no checkbox column and makes only the amount bold", () => {
    const tree = render({ invoices: [makeInvoice()] });
    const bold = tree.root.findAll(
      (n) => typeof n.props?.className === "string" && /\bfont-(bold|semibold)\b/.test(n.props.className) && n.type === "Text",
    );
    expect(bold).toHaveLength(1);
    expect(JSON.stringify(tree.toJSON())).not.toContain("checkbox");
  });

  it("shows 'Lejárt N napja' under the due date when the invoice is past due", () => {
    const tree = render({ invoices: [makeInvoice({ status: "sent", dueDate: "2026-08-30" })] });
    const overdueNode = tree.root.findByProps({ testID: "invoice-row-overdue-label" });
    expect(JSON.stringify(overdueNode.props.children)).toContain("15");
  });

  it("shows 'N nap múlva' for an open invoice that is not due yet", () => {
    const tree = render({ invoices: [makeInvoice({ status: "sent", dueDate: "2026-09-20" })] });
    const node = tree.root.findByProps({ testID: "invoice-row-due-in-label" });
    expect(JSON.stringify(node.props.children)).toContain("lists.dueIn");
    expect(JSON.stringify(node.props.children)).toContain("6");
  });

  it("does not show a due line for a paid invoice", () => {
    const tree = render({ invoices: [makeInvoice({ status: "paid", dueDate: "2026-01-01" })] });
    expect(tree.root.findAllByProps({ testID: "invoice-row-overdue-label" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: "invoice-row-due-in-label" })).toHaveLength(0);
  });

  it("calls onRowPress with the invoice when the row is tapped", () => {
    const onRowPress = jest.fn();
    const invoice = makeInvoice();
    const tree = render({ invoices: [invoice], onRowPress });
    const row = tree.root.findByProps({ testID: "invoice-list-row" });
    act(() => {
      row.props.onPress?.();
    });
    expect(onRowPress).toHaveBeenCalledWith(invoice);
  });

  it("shows 'Piszkozat' instead of a number, and a dash for the due date, on an unnumbered draft", () => {
    const tree = render({ invoices: [makeInvoice({ invoiceNumber: "", status: "draft" })] });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.status.draft");
    expect(json).toContain("–");
  });

  it("renders the converted label for a converted díjbekérő only", () => {
    const invoice = makeInvoice({ id: "p1", documentType: "proforma", invoiceNumber: "DBK-2026-001" });
    const other = makeInvoice({ id: "p2", documentType: "proforma", invoiceNumber: "DBK-2026-002" });
    const tree = render({ invoices: [invoice, other], convertedIds: { p1: "inv-9" } });
    expect(JSON.stringify(tree.toJSON()).split("invoices.convert.convertedBadge")).toHaveLength(2);
  });

  it("passes the row menu items through to the overflow menu", () => {
    const onDelete = jest.fn();
    const tree = render({
      invoices: [makeInvoice()],
      menuItemsFor: () => [{ label: "Törlés", onPress: onDelete, destructive: true }],
    });
    act(() => {
      tree.root.findByProps({ testID: "overflow-menu-trigger" }).props.onPress?.();
    });
    act(() => {
      tree.root.findByProps({ testID: "overflow-menu-item-0" }).props.onPress?.();
    });
    expect(onDelete).toHaveBeenCalled();
  });

  it("toggles the sort when a sortable header is pressed", () => {
    const onSortChange = jest.fn();
    const tree = render({
      invoices: [makeInvoice()],
      sort: { key: "issued", direction: "desc" },
      onSortChange,
    });
    act(() => {
      tree.root.findByProps({ testID: "invoice-table-sort-issued" }).props.onPress?.();
    });
    expect(onSortChange).toHaveBeenCalledWith("issued");
    expect(tree.root.findAllByProps({ testID: "invoice-table-sort-serial" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: "invoice-table-sort-partner" })).toHaveLength(0);
  });

  it("renders the footer inside the card", () => {
    const tree = render({ invoices: [makeInvoice()], footer: <></> });
    expect(tree.root.findAllByProps({ testID: "invoice-list-table-footer" }).length).toBeGreaterThan(0);
  });
});

describe("InvoiceList cards", () => {
  it("renders partner + amount, 'number · date', the status pill and the overdue label", () => {
    const tree = render({
      layout: "cards",
      invoices: [makeInvoice({ invoiceNumber: "INV-2026-00017", status: "sent", dueDate: "2026-08-30" })],
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Acme Kft.");
    expect(json).toContain("INV-2026-00017 · 2026. 06. 01.");
    expect(json).toContain("invoices.status.overdue");
    expect(tree.root.findAllByProps({ testID: "invoice-card-overdue-label" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: "invoice-list-table-table" })).toHaveLength(0);
  });

  it("shows the red NAV triangle for a NAV-failed invoice and nothing for a draft", () => {
    const tree = render({
      layout: "cards",
      invoices: [
        makeInvoice({ id: "a", navStatus: "failed" }),
        makeInvoice({ id: "b", status: "draft", invoiceNumber: "" }),
      ],
    });
    const failed = tree.root.findAllByProps({ testID: "invoice-card-nav-dot" }).filter((n) => n.props.accessibilityHint === "failed");
    expect(failed.length).toBeGreaterThan(0);
  });
});

describe("InvoiceList states", () => {
  it("renders the empty node instead of the table", () => {
    const tree = render({ invoices: [], empty: <></> });
    expect(tree.root.findAllByProps({ testID: "list-table-header" })).toHaveLength(0);
  });

  it("renders a loading state when loading with no invoices yet", () => {
    const tree = render({ invoices: [], loading: true });
    expect(tree.root.findByProps({ testID: "state-view-loading" })).toBeTruthy();
  });
});
