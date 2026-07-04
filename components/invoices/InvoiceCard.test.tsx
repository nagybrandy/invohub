// components/invoices/InvoiceCard.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { Alert } from "react-native";
import { InvoiceCard } from "@/components/invoices/InvoiceCard";
import { makeInvoice } from "@/__tests__/fixtures/invoices";

jest.mock("@/components/ui/badge", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/card", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));

function renderCard(props: React.ComponentProps<typeof InvoiceCard>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<InvoiceCard {...props} />);
  });
  return tree!;
}

function findPressable(root: TestRenderer.ReactTestInstance) {
  return root.find(
    (node) =>
      typeof node.props?.onPress === "function" ||
      typeof node.props?.onLongPress === "function"
  );
}

describe("InvoiceCard", () => {
  it("renders invoice number and client", () => {
    const tree = renderCard({ invoice: makeInvoice(), onDelete: jest.fn() });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("INV-2026-001");
    expect(json).toContain("Acme Kft.");
  });

  it("calls onPress when pressable is triggered", () => {
    const onPress = jest.fn();
    const invoice = makeInvoice();
    const tree = renderCard({
      invoice,
      onDelete: jest.fn(),
      onPress,
    });
    const pressable = findPressable(tree.root);
    act(() => {
      pressable.props.onPress?.();
    });
    expect(onPress).toHaveBeenCalled();
  });

  it("shows delete confirmation on long press", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
    const tree = renderCard({ invoice: makeInvoice(), onDelete: jest.fn() });
    const pressable = findPressable(tree.root);
    act(() => {
      pressable.props.onLongPress?.();
    });
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("renders proforma status label", () => {
    const tree = renderCard({
      invoice: makeInvoice({ status: "proforma" }),
      onDelete: jest.fn(),
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain("Proforma");
  });
});
