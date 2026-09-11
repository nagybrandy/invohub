// components/marketing/BrandLogo.test.tsx
// Ensures brand mark and lockup variants render with accessible labels.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { BrandLogo, BrandMark } from "@/components/marketing/BrandLogo";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

describe("BrandLogo", () => {
  it("renders the composed wordmark with a mark", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<BrandLogo tone="onDark" />);
    });
    expect(tree.root.findByProps({ testID: "brand-logo" })).toBeTruthy();
    expect(tree.root.findByProps({ testID: "brand-mark" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "InvoHub" })).toBeTruthy();
    tree.unmount();
  });

  it("renders an accessible vector mark on light surfaces", async () => {
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
  it("exposes an accessible mark image", async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(() => {
      tree = TestRenderer.create(<BrandMark size={28} />);
    });
    expect(tree.root.findByProps({ testID: "brand-mark" })).toBeTruthy();
    expect(
      tree.root.findAll((node) => node.props.accessibilityLabel === "InvoHub")
        .length,
    ).toBeGreaterThan(0);
    tree.unmount();
  });
});
