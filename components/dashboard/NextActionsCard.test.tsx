// components/dashboard/NextActionsCard.test.tsx
import TestRenderer, { act } from "react-test-renderer";
import { NextActionsCard } from "@/components/dashboard/NextActionsCard";

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
jest.mock("@/components/ui/card", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/heading", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));

function renderCard(props: React.ComponentProps<typeof NextActionsCard>) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<NextActionsCard {...props} />);
  });
  return tree!;
}

describe("NextActionsCard", () => {
  it("shows the all-clear message when there is nothing to do", () => {
    const tree = renderCard({ overdueCount: 0, draftCount: 0, onSelect: jest.fn() });
    expect(() => tree.root.findByProps({ testID: "next-actions-all-clear" })).not.toThrow();
  });

  it("renders a row for overdue invoices and one for drafts", () => {
    const tree = renderCard({ overdueCount: 2, draftCount: 5, onSelect: jest.fn() });
    expect(() => tree.root.findByProps({ testID: "next-action-row-overdue" })).not.toThrow();
    expect(() => tree.root.findByProps({ testID: "next-action-row-drafts" })).not.toThrow();
  });

  it("never renders more than 3 rows", () => {
    const tree = renderCard({ overdueCount: 4, draftCount: 9, onSelect: jest.fn() });
    const container = tree.root.findByProps({ testID: "next-actions-rows" });
    expect(container.children.length).toBeLessThanOrEqual(3);
  });

  it("calls onSelect with 'overdue' when the overdue row is tapped", () => {
    const onSelect = jest.fn();
    const tree = renderCard({ overdueCount: 3, draftCount: 0, onSelect });
    const row = tree.root.findByProps({ testID: "next-action-row-overdue" });
    act(() => {
      row.props.onPress?.();
    });
    expect(onSelect).toHaveBeenCalledWith("overdue");
  });

  it("shows a loading skeleton instead of rows while loading", () => {
    const tree = renderCard({ overdueCount: 0, draftCount: 0, loading: true, onSelect: jest.fn() });
    expect(() => tree.root.findByProps({ testID: "next-actions-all-clear" })).toThrow();
  });
});
