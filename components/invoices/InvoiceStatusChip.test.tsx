// components/invoices/InvoiceStatusChip.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { InvoiceStatusChip } from "@/components/invoices/InvoiceStatusChip";
import type { InvoiceStatus } from "@/lib/invoices/types";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

function render(status: InvoiceStatus, size?: "sm" | "md") {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<InvoiceStatusChip status={status} size={size} />);
  });
  return tree!;
}

const ALL: InvoiceStatus[] = ["draft", "proforma", "sent", "paid", "partially_paid", "unpaid", "overdue", "cancelled"];

describe("InvoiceStatusChip", () => {
  it("renders the translated status label", () => {
    const tree = render("sent");
    const text = tree.root.findByType(Text);
    expect(text.props.children).toBe("invoices.status.sent");
  });

  it.each([
    ["paid", "bg-ok-wash", "text-ok"],
    ["overdue", "bg-err-wash", "text-err"],
    ["sent", "bg-primary-wash", "text-primary-ink"],
    ["unpaid", "bg-primary-wash", "text-primary-ink"],
    ["partially_paid", "bg-warn-wash", "text-warn"],
    ["draft", "bg-neutral-wash", "text-muted-ink"],
    ["proforma", "bg-neutral-wash", "text-muted-ink"],
    ["cancelled", "bg-neutral-wash", "text-muted-ink"],
  ] as const)("%s uses %s / %s", (status, bg, fg) => {
    const tree = render(status);
    expect(tree.root.findByProps({ testID: "invoice-status-chip" }).props.className).toContain(bg);
    expect(tree.root.findByType(Text).props.className).toContain(fg);
  });

  it("is a 6px pill with 12px regular text", () => {
    const tree = render("draft");
    const chip = tree.root.findByProps({ testID: "invoice-status-chip" });
    expect(chip.props.className).toContain("rounded-pill");
    expect(chip.props.className).toContain("px-[9px]");
    expect(tree.root.findByType(Text).props.className).toContain("text-xs");
    expect(tree.root.findByType(Text).props.className).not.toMatch(/font-(medium|semibold|bold)/);
  });

  it("only paid is green and only overdue is red", () => {
    for (const status of ALL) {
      const className = render(status).root.findByProps({ testID: "invoice-status-chip" }).props.className as string;
      expect(/bg-ok/.test(className)).toBe(status === "paid");
      expect(/bg-err/.test(className)).toBe(status === "overdue");
    }
  });

  it("is not uppercase and has no border", () => {
    const tree = render("draft");
    expect(tree.root.findByType(Text).props.className).not.toMatch(/uppercase/);
    expect(tree.root.findByProps({ testID: "invoice-status-chip" }).props.className).not.toMatch(/\bborder\b/);
  });

  it("renders the same pill for both sizes", () => {
    const sm = render("draft", "sm").root.findByProps({ testID: "invoice-status-chip" }).props.className;
    const md = render("draft", "md").root.findByProps({ testID: "invoice-status-chip" }).props.className;
    expect(sm).toBe(md);
  });
});
