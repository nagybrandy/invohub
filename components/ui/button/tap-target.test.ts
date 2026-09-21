// components/ui/button/tap-target.test.ts
// AC1–AC3: the 44px floor (Apple HIG 44pt / WCAG 2.5.8 AAA) lives in
// buttonStyle itself, not at each call site. Pure unit test on the exported
// `buttonStyle` — no rendering, so it can't be defeated by cssInterop
// indirection under jest-expo.
import { buttonStyle } from "@/components/ui/button";
import { MIN_TAP_TARGET_PX, TAP_TARGET_MIN_H } from "@/lib/ui/tap-target";

describe("Button size variants clear the 44px tap-target floor", () => {
  it.each(["default", "sm", "lg"] as const)("size=%s clears the 44px floor", (size) => {
    expect(buttonStyle({ size })).toContain(TAP_TARGET_MIN_H);
  });

  it("icon size is a 44x44 box", () => {
    expect(buttonStyle({ size: "icon" })).toContain("h-11 w-11");
  });

  it("keeps the size scale's horizontal/type differences", () => {
    expect(buttonStyle({ size: "sm" })).toContain("px-3");
    expect(buttonStyle({ size: "sm" })).toContain("text-xs");
    expect(buttonStyle({ size: "lg" })).toContain("px-8");
  });

  it("defaults to the floor with no args", () => {
    expect(buttonStyle()).toContain(TAP_TARGET_MIN_H);
  });

  it("documents the floor it enforces", () => {
    expect(MIN_TAP_TARGET_PX).toBe(44);
  });
});
