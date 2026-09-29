// components/ui/choice-pill/tap-target-css-resolution.test.ts
//
// index.test.tsx only checks that TAP_TARGET_MIN_H appears as a *string* in
// the composed className (and trails it). That can't detect whether the
// 44px floor actually wins once NativeWind/Tailwind turns those classes
// into real CSS: two same-specificity single-class utility selectors are
// resolved by the ORDER Tailwind emits them in the generated stylesheet
// (grouped by the theme scale each utility comes from), not by the order
// the classNames appear in the JSX string. This test runs the project's
// real tailwind.config.js through Tailwind/PostCSS the way NativeWind's web
// build does, and asserts on the winning *declaration*, so a future scale
// change, a renamed token, or an arbitrary-value/`!important` caller
// className that defeats the floor fails loudly here instead of silently
// passing index.test.tsx's string check.
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import postcss from "postcss";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tailwindcss = require("tailwindcss");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const baseTailwindConfig = require("../../../tailwind.config.js");
import { ChoicePill } from "@/components/ui/choice-pill";
import { Pressable as MockPressable } from "@/__tests__/mocks/gluestack-ui";

jest.mock("@/components/ui/hstack", () => require("@/__tests__/mocks/gluestack-ui"));
jest.mock("@/components/ui/pressable", () => require("@/__tests__/mocks/gluestack-ui"));

function resolvedClassNameFor(className: string) {
  let tree: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ChoicePill testID="test-pill" onPress={jest.fn()} className={className}>
        <Text>label</Text>
      </ChoicePill>
    );
  });
  return String(tree!.root.findByType(MockPressable).props.className);
}

/**
 * Compiles `classNames` through this repo's real tailwind.config.js and
 * returns, for `property`, the value of the LAST emitted rule that sets it
 * among the classes present — i.e. the value that wins the cascade when a
 * single element carries all of these classes (same-specificity, single
 * class selectors: last declaration in source order wins).
 */
async function winningCascadeValue(classNames: string, property: string) {
  const config = {
    ...baseTailwindConfig,
    content: [{ raw: `<div class="${classNames}"></div>`, extension: "html" }],
  };
  const result = await postcss([tailwindcss(config)]).process("@tailwind utilities;", {
    from: undefined,
  });

  let winner: string | undefined;
  result.root.walkRules((rule) => {
    rule.walkDecls(property, (decl) => {
      winner = decl.value;
    });
  });
  return winner;
}

describe("ChoicePill tap-target floor — real CSS cascade resolution", () => {
  it("keeps min-height: 2.75rem (44px) as the winning declaration even when the caller passes a hostile min-h-0", async () => {
    const className = resolvedClassNameFor("py-0.5 min-h-0");
    expect(className).toContain("min-h-0");
    expect(className).toContain("min-h-11");

    const winningMinHeight = await winningCascadeValue(className, "min-height");
    expect(winningMinHeight).toBe("2.75rem");
  });

  it("keeps BASE's py-2 winning over a smaller caller py-* override regardless of className string order", async () => {
    // Not because BASE is "overridden last" (it isn't — the caller
    // className sits after BASE in the string) but because 2 > 0.5 on the
    // spacing scale, so `.py-2` is emitted after `.py-0\.5` in the
    // generated stylesheet no matter where either class appears in markup.
    const className = resolvedClassNameFor("py-0.5");
    const winningPaddingTop = await winningCascadeValue(className, "padding-top");
    expect(winningPaddingTop).toBe("0.5rem"); // py-2, not py-0.5's 0.125rem
  });
});
