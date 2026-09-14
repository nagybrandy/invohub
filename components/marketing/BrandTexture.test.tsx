// components/marketing/BrandTexture.test.tsx
// Ensures the decorative brand texture stays inert, low-contrast, and seamless.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Circle, Path, Pattern } from "react-native-svg";
import { BrandTexture } from "@/components/marketing/BrandTexture";
import {
  BRAND_MARK_VARIANTS,
  BRAND_TILE_GEOMETRY,
  BRAND_TILE_VIEWBOX,
} from "@/components/marketing/brand-mark-geometry";

jest.mock("@/components/ui/box", () => require("@/__tests__/mocks/gluestack-ui"));

function render(node: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(node);
  });
  return tree;
}

function unmount(tree: TestRenderer.ReactTestRenderer) {
  act(() => {
    tree.unmount();
  });
}

describe("BrandTexture", () => {
  it("renders an inert, non-interactive, screen-reader-hidden layer", () => {
    const tree = render(<BrandTexture />);
    const layer = tree.root.findByProps({ testID: "brand-texture" });
    expect(layer.props.pointerEvents).toBe("none");
    expect(layer.props.accessibilityElementsHidden).toBe(true);
    expect(layer.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(layer.props.className).toContain("pointer-events-none");
    expect(layer.props.className).toContain("absolute");
    unmount(tree);
  });

  it.each(BRAND_MARK_VARIANTS)("tiles the seamless 96-unit %s motif", (variant) => {
    const tree = render(<BrandTexture mark={variant} tile={140} rotate={12} />);
    const pattern = tree.root.findByType(Pattern);
    expect(pattern.props.width).toBe(140);
    expect(pattern.props.height).toBe(140);
    expect(pattern.props.patternUnits).toBe("userSpaceOnUse");
    expect(pattern.props.viewBox).toBe(`0 0 ${BRAND_TILE_VIEWBOX} ${BRAND_TILE_VIEWBOX}`);
    expect(pattern.props.patternTransform).toBe("rotate(12)");

    const paths = tree.root.findAllByType(Path).map((node) => node.props.d as string);
    const circles = tree.root
      .findAllByType(Circle)
      .map((node) => `${node.props.cx},${node.props.cy},${node.props.r}`);
    for (const shape of BRAND_TILE_GEOMETRY[variant].shapes) {
      if (shape.kind === "circle") {
        expect(circles).toContain(`${shape.cx},${shape.cy},${shape.r}`);
      } else {
        expect(paths).toContain(shape.d);
      }
    }
    unmount(tree);
  });

  it("keeps the diagonal chains butt-capped so tiles join without a seam", () => {
    const tree = render(<BrandTexture mark="rounded" />);
    const chains = tree.root
      .findAllByType(Path)
      .filter((node) => (node.props.d as string).startsWith("M0 48L48 0"));
    expect(chains).toHaveLength(1);
    expect(chains[0].props.strokeLinecap).toBe("butt");
    unmount(tree);
  });

  it("clamps opacity so decoration can never dominate the surface", () => {
    const tree = render(<BrandTexture opacity={0.9} />);
    const layer = tree.root.findByProps({ testID: "brand-texture" });
    const opacities = layer
      .findAll((node) => typeof node.props.opacity === "number")
      .map((node) => node.props.opacity as number);
    expect(Math.max(...opacities)).toBeLessThanOrEqual(0.14);
    unmount(tree);
  });

  it("renders nothing when opacity is zeroed out", () => {
    const tree = render(<BrandTexture opacity={0} />);
    expect(tree.root.findAllByProps({ testID: "brand-texture" })).toHaveLength(0);
    unmount(tree);
  });

  it("supports a single rotated watermark mark", () => {
    const tree = render(<BrandTexture variant="mark" rotate={-16} size={280} />);
    expect(tree.root.findAllByType(Pattern)).toHaveLength(0);
    const rotated = tree.root.findAll((node) => node.props.rotation === -16);
    expect(rotated.length).toBeGreaterThan(0);
    unmount(tree);
  });
});
