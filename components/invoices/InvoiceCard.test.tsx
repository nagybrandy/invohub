// components/invoices/InvoiceCard.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { InvoiceCard } from "@/components/invoices/InvoiceCard";
import { makeInvoice } from "@/__tests__/fixtures/invoices";
import { confirmAsync } from "@/lib/ui/confirm";

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
jest.mock("@/lib/ui/confirm", () => ({
  confirmAsync: jest.fn(),
}));
jest.mock("@/components/ui/badge", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/card", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));

const mockConfirmAsync = confirmAsync as jest.MockedFunction<typeof confirmAsync>;

function renderCard(props: React.ComponentProps<typeof InvoiceCard>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<InvoiceCard {...props} />);
  });
  return tree!;
}

function openRowMenu(tree: TestRenderer.ReactTestRenderer) {
  const trigger = tree.root.findByProps({ testID: "overflow-menu-trigger" });
  act(() => {
    trigger.props.onPress?.();
  });
}

describe("InvoiceCard", () => {
  beforeEach(() => {
    mockConfirmAsync.mockReset();
  });

  it("renders invoice number and client", () => {
    const tree = renderCard({ invoice: makeInvoice(), onDelete: jest.fn() });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("INV-2026-001");
    expect(json).toContain("Acme Kft.");
  });

  it("calls onPress when the card body is tapped", () => {
    const onPress = jest.fn();
    const invoice = makeInvoice();
    const tree = renderCard({
      invoice,
      onDelete: jest.fn(),
      onPress,
    });
    const cardPressable = tree.root.find(
      (node) => node.props?.testID === "invoice-card-press"
    );
    act(() => {
      cardPressable.props.onPress?.();
    });
    expect(onPress).toHaveBeenCalledWith(invoice);
  });

  it("has no visible trash icon in the row — delete lives in the ⋯ menu (L4)", () => {
    const tree = renderCard({ invoice: makeInvoice(), onDelete: jest.fn() });
    const directDeleteButtons = tree.root.findAll(
      (node) => node.props?.accessibilityLabel === "invoices.card.deleteAction"
    );
    expect(directDeleteButtons).toHaveLength(0);
  });

  it("deletes from the last, destructive ⋯ menu item after confirming", async () => {
    mockConfirmAsync.mockResolvedValue(true);
    const onDelete = jest.fn();
    const invoice = makeInvoice();
    const tree = renderCard({ invoice, onDelete, onPreview: jest.fn() });

    openRowMenu(tree);
    // With onPreview provided, item 0 is preview and item 1 is delete (last).
    const deleteItem = tree.root.findByProps({ testID: "overflow-menu-item-1" });
    const destructiveDescendants = deleteItem.findAll(
      (node) =>
        typeof node.props?.className === "string" &&
        node.props.className.includes("text-destructive")
    );
    expect(destructiveDescendants.length).toBeGreaterThan(0);

    await act(async () => {
      await deleteItem.props.onPress?.();
    });

    expect(mockConfirmAsync).toHaveBeenCalledWith(
      expect.objectContaining({ destructive: true })
    );
    expect(onDelete).toHaveBeenCalledWith(invoice.id);
  });

  it("does not delete when the confirmation is dismissed", async () => {
    mockConfirmAsync.mockResolvedValue(false);
    const onDelete = jest.fn();
    const tree = renderCard({ invoice: makeInvoice(), onDelete });

    openRowMenu(tree);
    const deleteItem = tree.root.findByProps({ testID: "overflow-menu-item-0" });

    await act(async () => {
      await deleteItem.props.onPress?.();
    });

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("opens quick preview from the ⋯ menu", () => {
    const onPreview = jest.fn();
    const invoice = makeInvoice();
    const tree = renderCard({ invoice, onDelete: jest.fn(), onPreview });

    openRowMenu(tree);
    const previewItem = tree.root.findByProps({ testID: "overflow-menu-item-0" });
    act(() => {
      previewItem.props.onPress?.();
    });

    expect(onPreview).toHaveBeenCalledWith(invoice);
  });

  it("shows an overdue subtext under the due date when the invoice is past due", () => {
    const invoice = makeInvoice({ status: "sent", dueDate: "2020-01-01" });
    const tree = renderCard({
      invoice,
      onDelete: jest.fn(),
      now: new Date("2020-02-01T00:00:00.000Z"),
    });
    const overdueLabel = tree.root.findByProps({ testID: "invoice-card-overdue-label" });
    expect(overdueLabel).toBeTruthy();
  });

  it("renders the proforma status label via the shared status chip", () => {
    const tree = renderCard({
      invoice: makeInvoice({ status: "proforma" }),
      onDelete: jest.fn(),
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.proforma");
  });

  it("offers 'Számla készítése ebből' in the ⋯ menu for a díjbekérő when onConvert is passed (AC21 mobile parity)", () => {
    const onConvert = jest.fn();
    const invoice = makeInvoice({ documentType: "proforma", status: "proforma" });
    const tree = renderCard({ invoice, onDelete: jest.fn(), onConvert });

    openRowMenu(tree);
    // No onPreview here, so item 0 is convert and item 1 is delete.
    const convertItem = tree.root.findByProps({ testID: "overflow-menu-item-0" });
    act(() => {
      convertItem.props.onPress?.();
    });

    expect(onConvert).toHaveBeenCalledWith(invoice);
  });

  it("does not offer the convert entry for a non-proforma invoice even when onConvert is passed", () => {
    const onConvert = jest.fn();
    const tree = renderCard({
      invoice: makeInvoice({ documentType: "invoice" }),
      onDelete: jest.fn(),
      onConvert,
    });

    openRowMenu(tree);
    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain("invoices.convert.action");
  });

  it("does not offer the convert entry for a díjbekérő when onConvert is not passed", () => {
    const tree = renderCard({
      invoice: makeInvoice({ documentType: "proforma", status: "proforma" }),
      onDelete: jest.fn(),
    });

    openRowMenu(tree);
    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain("invoices.convert.action");
  });
});
