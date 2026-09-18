// components/invoices/InvoiceFilterChips.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { InvoiceFilterChips } from "@/components/invoices/InvoiceFilterChips";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

const t = (key: string, opts?: Record<string, unknown>) =>
  opts ? `${key}:${JSON.stringify(opts)}` : key;

function render(props: Partial<React.ComponentProps<typeof InvoiceFilterChips>> = {}) {
  const onSelect = props.onSelect ?? jest.fn();
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <InvoiceFilterChips
        filter={props.filter ?? "all"}
        onSelect={onSelect}
        counts={props.counts ?? { draft: 2, sent: 1, unpaid: 0, overdue: 0, paid: 3 }}
        allCount={props.allCount ?? 6}
        otherCount={props.otherCount ?? 0}
        t={t}
      />
    );
  });
  return { tree: tree!, onSelect };
}

// The rendered ChoicePill's own outer fiber reflects exactly the props
// InvoiceFilterChips passed it (testID, className="rounded-full", no
// accessibilityState of its own) — the inner Pressable ChoicePill renders
// carries the COMPUTED className and accessibilityState. Find that one.
function renderedChip(tree: TestRenderer.ReactTestRenderer, testID: string) {
  // The first (shallowest) match carrying accessibilityState is the mocked
  // Pressable component itself — deeper matches are react-native's own
  // Pressable internals, which consume/transform onPress before it reaches
  // the host node, so firing onPress there would be a no-op.
  return tree.root.findAll(
    (n) => n.props?.testID === testID && n.props?.accessibilityState !== undefined
  )[0];
}

describe("InvoiceFilterChips (AC7)", () => {
  it("renders each filter chip with its invoice-filter-<f> testID and min-h-11", () => {
    const { tree } = render();
    for (const f of ["all", "draft", "sent", "unpaid", "overdue", "paid"]) {
      const chip = renderedChip(tree, `invoice-filter-${f}`);
      expect(chip).toBeDefined();
      expect(String(chip!.props.className)).toContain("min-h-11");
    }
  });

  it("calls onSelect with the pressed filter's status", () => {
    const { tree, onSelect } = render();
    const chip = renderedChip(tree, "invoice-filter-paid");
    act(() => {
      chip!.props.onPress?.();
    });
    expect(onSelect).toHaveBeenCalledWith("paid");
  });

  it("marks the active filter as selected", () => {
    const { tree } = render({ filter: "sent" });
    const active = renderedChip(tree, "invoice-filter-sent");
    const inactive = renderedChip(tree, "invoice-filter-draft");
    expect(active!.props.accessibilityState?.selected).toBe(true);
    expect(inactive!.props.accessibilityState?.selected).toBe(false);
  });
});

describe("InvoiceFilterChips — 'Egyéb' remainder (AC8)", () => {
  it("is absent when otherCount is 0", () => {
    const { tree } = render({ otherCount: 0 });
    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain("invoices.list.filterOther");
  });

  it("renders the filterCount text but as a non-interactive node with no onPress", () => {
    const { tree } = render({ otherCount: 4 });
    const nodesWithOtherText = tree.root.findAll(
      (n) =>
        typeof n.props?.children === "string" &&
        n.props.children.includes("invoices.list.filterOther")
    );
    expect(nodesWithOtherText.length).toBeGreaterThan(0);
    // Neither the text node nor any of its ancestors up to the root may
    // carry an onPress — it must not look or act like a working chip.
    for (const node of nodesWithOtherText) {
      let current: typeof node | null = node;
      while (current) {
        expect(current.props?.onPress).toBeUndefined();
        current = current.parent;
      }
    }
  });
});
