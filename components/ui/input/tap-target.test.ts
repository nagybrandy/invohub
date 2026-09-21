// components/ui/input/tap-target.test.ts
// Pure unit test on the exported `inputStyle` — no rendering. Input's root is
// a cssInterop-wrapped Gluestack View, and asserting on className after
// cssInterop under jest-expo is the kind of indirection that makes a guard
// test flaky, so this asserts on the tva() function directly instead.
import { inputStyle } from "@/components/ui/input";
import { MIN_TAP_TARGET_PX, TAP_TARGET_H } from "@/lib/ui/tap-target";

it("clears the 44px floor by default", () => {
  expect(inputStyle()).toContain(TAP_TARGET_H);
  expect(inputStyle()).not.toContain("h-9");
});

it("keeps the floor when a call site passes a layout className", () => {
  expect(inputStyle({ class: "flex-1" })).toContain(TAP_TARGET_H);
});

it("keeps the rest of the base intact", () => {
  for (const c of [
    "w-full",
    "flex-row",
    "items-center",
    "rounded-lg",
    "px-3",
    "data-[invalid=true]:border-destructive/40",
  ]) {
    expect(inputStyle()).toContain(c);
  }
});

it("documents the floor it enforces", () => {
  expect(MIN_TAP_TARGET_PX).toBe(44);
  expect(TAP_TARGET_H).toBe("h-11");
});
