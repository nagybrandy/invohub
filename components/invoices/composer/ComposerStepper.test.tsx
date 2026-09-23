// components/invoices/composer/ComposerStepper.test.tsx
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { ComposerStepper } from "@/components/invoices/composer/ComposerStepper";

jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/vstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

const t = (key: string) => key;

function render(
  current: "partner" | "items" | "review" = "partner",
  onSelect = jest.fn(),
  invalidSteps = { partner: false, items: false, review: false }
) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ComposerStepper
        current={current}
        invalidSteps={invalidSteps}
        onSelect={onSelect}
        t={t}
      />
    );
  });
  return { tree: tree!, onSelect };
}

describe("ComposerStepper", () => {
  it("renders all three steps with accessibilityRole=tab, selecting the current one", () => {
    const { tree } = render("items");
    const steps = tree.root.findAll((n) => n.props?.accessibilityRole === "tab");
    expect(steps.length).toBeGreaterThan(0);
    const current = steps.find((n) => n.props?.accessibilityState?.selected === true);
    expect(current).toBeDefined();
  });

  it("calls onSelect with the pressed step id", () => {
    const { tree, onSelect } = render("partner");
    // Non-current steps render as a numbered circle only (the labels wrapped
    // the row at 375px), so address the row by its testID.
    const step = tree.root
      .findAll((n) => typeof n.props?.onPress === "function")
      .find((n) => n.props?.testID === "composer-stepper-review");
    act(() => {
      step?.props.onPress?.();
    });
    expect(onSelect).toHaveBeenCalledWith("review");
  });

  it("renders each step row at a >=44px tap target (AC11)", () => {
    const { tree } = render("partner");
    const rows = tree.root.findAll(
      (n) => typeof n.props?.onPress === "function" && typeof n.props?.className === "string"
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(String(row.props.className)).toContain("min-h-11");
    }
  });
});

describe("ComposerStepper — compact on a narrow screen", () => {
  it("spells out only the current step", () => {
    const { tree } = render("items");
    const labels = tree.root
      .findAll((n) => typeof n.props?.children === "string")
      .map((n) => n.props.children as string)
      .filter((l) => l.startsWith("invoices.composer.steps."));

    // the same label matches on several fiber nodes — uniqueness is the point
    expect([...new Set(labels)]).toEqual(["invoices.composer.steps.items"]);
  });

  it("keeps the label of a step that has a blocking error, so it stays findable", () => {
    const { tree } = render("partner", jest.fn(), { partner: false, items: true, review: false });
    const labels = tree.root
      .findAll((n) => typeof n.props?.children === "string")
      .map((n) => n.props.children as string)
      .filter((l) => l.startsWith("invoices.composer.steps."));

    expect(labels).toContain("invoices.composer.steps.items");
  });
});
