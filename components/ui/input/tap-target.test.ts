// components/ui/input/tap-target.test.ts
// Redesign 2026-11 (tokens.md §6.3): inputs are 42px high. Pure unit test on
// the exported `inputStyle` — no rendering. Input's root is a
// cssInterop-wrapped Gluestack View, and asserting on className after
// cssInterop under jest-expo is the kind of indirection that makes a guard
// test flaky, so this asserts on the tva() function directly instead.
import { INPUT_HEIGHT_PX, inputStyle } from "@/components/ui/input";

it("is 42px high by default", () => {
  expect(INPUT_HEIGHT_PX).toBe(42);
  expect(inputStyle()).toContain("h-[42px]");
});

it("keeps the height when a call site passes a layout className", () => {
  expect(inputStyle({ class: "flex-1" })).toContain("h-[42px]");
});

it("uses the design tokens for border, surface, focus, invalid and disabled states", () => {
  const cls = inputStyle();
  for (const c of [
    "w-full",
    "flex-row",
    "items-center",
    "rounded-control",
    "border-line-strong",
    "bg-surface",
    "px-3",
    "data-[focus=true]:border-primary",
    "data-[focus=true]:web:outline-2",
    "data-[invalid=true]:border-err",
    "data-[disabled=true]:bg-wash2",
  ]) {
    expect(cls).toContain(c);
  }
  expect(cls).not.toMatch(/#[0-9a-fA-F]{3,6}/);
});
