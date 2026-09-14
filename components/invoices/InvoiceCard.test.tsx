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

  it("has a visible delete button (not just long-press) that confirms before deleting", async () => {
    mockConfirmAsync.mockResolvedValue(true);
    const onDelete = jest.fn();
    const invoice = makeInvoice();
    const tree = renderCard({ invoice, onDelete });

    const deleteButton = tree.root.find(
      (node) => node.props?.accessibilityLabel === "invoices.card.deleteAction"
    );

    await act(async () => {
      await deleteButton.props.onPress?.();
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

    const deleteButton = tree.root.find(
      (node) => node.props?.accessibilityLabel === "invoices.card.deleteAction"
    );

    await act(async () => {
      await deleteButton.props.onPress?.();
    });

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("renders the proforma status label via the shared status i18n map", () => {
    const tree = renderCard({
      invoice: makeInvoice({ status: "proforma" }),
      onDelete: jest.fn(),
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("invoices.proforma");
  });
});
