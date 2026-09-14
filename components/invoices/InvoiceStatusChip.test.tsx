// components/invoices/InvoiceStatusChip.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { InvoiceStatusChip } from "@/components/invoices/InvoiceStatusChip";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

function render(status: Parameters<typeof InvoiceStatusChip>[0]["status"], size?: "sm" | "md") {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<InvoiceStatusChip status={status} size={size} />);
  });
  return tree!;
}

describe("InvoiceStatusChip", () => {
  it("renders the translated status label", () => {
    const tree = render("sent");
    const text = tree.root.findByType(Text);
    expect(text.props.children).toBe("invoices.status.sent");
  });

  it("renders paid with the approved green classes", () => {
    const tree = render("paid");
    const chip = tree.root.findByProps({ testID: "invoice-status-chip" });
    expect(chip.props.className).toContain("#15803d");
    const text = tree.root.findByType(Text);
    expect(text.props.className).toContain("#15803d");
  });

  it("never uses green for a non-paid status", () => {
    const statuses = ["draft", "proforma", "sent", "partially_paid", "unpaid", "overdue", "cancelled"] as const;
    for (const status of statuses) {
      const tree = render(status);
      const chip = tree.root.findByProps({ testID: "invoice-status-chip" });
      expect(chip.props.className).not.toMatch(/green/i);
      expect(chip.props.className).not.toMatch(/#15803d/i);
    }
  });

  it("is not uppercase (className has no uppercase utility)", () => {
    const tree = render("draft");
    const text = tree.root.findByType(Text);
    expect(text.props.className).not.toMatch(/uppercase/);
  });

  it("supports a smaller size for dense rows", () => {
    const tree = render("draft", "sm");
    const chip = tree.root.findByProps({ testID: "invoice-status-chip" });
    expect(chip.props.className).toContain("px-2 ");
  });
});
