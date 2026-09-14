// components/marketing/BrandLogo.test.tsx
// Ensures the wordmark and both mark directions render with accessible labels.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Circle, Path } from "react-native-svg";
import { BrandLogo, BrandMark } from "@/components/marketing/BrandLogo";
import {
  BRAND_MARK_DEFAULT,
  BRAND_MARK_GEOMETRY,
  BRAND_MARK_VARIANTS,
  type BrandMarkVariant,
} from "@/components/marketing/brand-mark-geometry";
import { landingColors } from "@/components/marketing/landing-theme";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/text", () => require("@/__tests__/mocks/gluestack-ui"));

async function render(node: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(() => {
    tree = TestRenderer.create(node);
  });
  return tree;
}

async function unmount(tree: TestRenderer.ReactTestRenderer) {
  await act(async () => tree.unmount());
}

/** Every shape the mark draws, whatever primitive carries it. */
function drawnShapes(tree: TestRenderer.ReactTestRenderer) {
  return [
    ...tree.root.findAllByType(Path).map((node) => node.props.d as string),
    ...tree.root
      .findAllByType(Circle)
      .map((node) => `circle:${node.props.cx},${node.props.cy},${node.props.r}`),
  ];
}

function expectedShapes(variant: BrandMarkVariant) {
  const geometry = BRAND_MARK_GEOMETRY[variant];
  return [...geometry.frame, ...geometry.flow].map((shape) =>
    shape.kind === "circle" ? `circle:${shape.cx},${shape.cy},${shape.r}` : shape.d,
  );
}

describe("BrandLogo", () => {
  it("renders the wordmark without the mark by default", async () => {
    const tree = await render(<BrandLogo tone="onDark" />);
    expect(tree.root.findByProps({ testID: "brand-logo" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Invo" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Hub" })).toBeTruthy();
    expect(tree.root.findAllByProps({ testID: "brand-logo-mark" })).toHaveLength(0);
    await unmount(tree);
  });

  it("pairs the wordmark with the SVG mark when asked", async () => {
    const tree = await render(<BrandLogo tone="onDark" withMark />);
    expect(tree.root.findByProps({ testID: "brand-logo-mark" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Invo" })).toBeTruthy();
    await unmount(tree);
  });

  it("keeps contrast classes on light surfaces", async () => {
    const tree = await render(<BrandLogo tone="onLight" height={40} />);
    expect(tree.root.findByProps({ testID: "brand-logo" })).toBeTruthy();
    expect(
      tree.root.findAll((node) => node.props.accessibilityLabel === "InvoHub").length,
    ).toBeGreaterThan(0);
    await unmount(tree);
  });
});

describe("BrandMark", () => {
  it.each(BRAND_MARK_VARIANTS)("draws every shape of the %s direction", async (variant) => {
    const tree = await render(<BrandMark mark={variant} size={28} />);
    expect(tree.root.findByProps({ testID: "brand-mark" })).toBeTruthy();

    const drawn = drawnShapes(tree);
    for (const shape of expectedShapes(variant)) {
      expect(drawn).toContain(shape);
    }
    await unmount(tree);
  });

  it("draws the default direction when none is given", async () => {
    const tree = await render(<BrandMark />);
    const drawn = drawnShapes(tree);
    for (const shape of expectedShapes(BRAND_MARK_DEFAULT)) {
      expect(drawn).toContain(shape);
    }
    await unmount(tree);
  });

  it("accents the flow in cornflower on dark surfaces and inks it navy on light", async () => {
    const dark = await render(<BrandMark tone="onDark" />);
    const darkInks = dark.root
      .findAll((node) => typeof node.props.stroke === "string" || typeof node.props.fill === "string")
      .flatMap((node) => [node.props.stroke, node.props.fill]);
    expect(darkInks).toContain(landingColors.white);
    expect(darkInks).toContain(landingColors.cornflower);
    await unmount(dark);

    const light = await render(<BrandMark tone="onLight" variant="mono" />);
    const lightInks = light.root
      .findAll((node) => typeof node.props.stroke === "string" || typeof node.props.fill === "string")
      .flatMap((node) => [node.props.stroke, node.props.fill]);
    expect(lightInks).toContain(landingColors.navy);
    expect(lightInks).not.toContain(landingColors.cornflower);
    await unmount(light);
  });
});
