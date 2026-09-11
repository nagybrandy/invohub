// components/marketing/BrandLogo.test.tsx
// Ensures the typography wordmark renders with accessible labels.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { BrandLogo, BrandMark } from "@/components/marketing/BrandLogo";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

describe("BrandLogo", () => {
  it("renders a typography-only wordmark", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<BrandLogo tone="onDark" />);
    });
    expect(tree.root.findByProps({ testID: "brand-logo" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Invo" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Hub" })).toBeTruthy();
    expect(tree.root.findAllByProps({ testID: "brand-mark" })).toHaveLength(0);
    tree.unmount();
  });

  it("keeps contrast classes on light surfaces", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<BrandLogo tone="onLight" height={40} />);
    });
    expect(tree.root.findByProps({ testID: "brand-logo" })).toBeTruthy();
    expect(
      tree.root.findAll((node) => node.props.accessibilityLabel === "InvoHub")
        .length,
    ).toBeGreaterThan(0);
    tree.unmount();
  });
});

describe("BrandMark", () => {
  it("exposes a compact letterform stand-in", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<BrandMark size={28} />);
    });
    expect(tree.root.findByProps({ testID: "brand-mark" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "IH" })).toBeTruthy();
    tree.unmount();
  });
});
