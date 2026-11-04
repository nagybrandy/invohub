// components/ui/button/tap-target.test.ts
// Redesign 2026-11 (tokens.md §6.2): button heights are the design's, not
// the old 44px floor: sm 34 (40 on phones), md 40, form 42, lg 46. Touch
// targets stay >= 40px on phones. Pure unit test on the exported
// `buttonStyle` so cssInterop indirection under jest-expo cannot defeat it.
import { buttonStyle } from "@/components/ui/button";

describe("Button sizes follow the design heights", () => {
  it.each([
    ["md", "h-10"],
    ["form", "h-[42px]"],
    ["lg", "h-[46px]"],
  ] as const)("size=%s is %s", (size, cls) => {
    expect(buttonStyle({ size })).toContain(cls);
  });

  it("sm is 34px and grows to 40px on phones", () => {
    const sm = buttonStyle({ size: "sm" });
    expect(sm).toContain("h-[34px]");
    expect(sm).toContain("phone:h-10");
  });

  it("icon size is a 34px square (40 on phones)", () => {
    const icon = buttonStyle({ size: "icon" });
    expect(icon).toContain("h-[34px] w-[34px]");
    expect(icon).toContain("phone:h-10 phone:w-10");
  });

  it("the default size is the 40px md size", () => {
    expect(buttonStyle()).toContain("h-10");
  });

  it("keeps the size scale's horizontal padding differences", () => {
    expect(buttonStyle({ size: "sm" })).toContain("px-3");
    expect(buttonStyle({ size: "lg" })).toContain("px-[22px]");
    expect(buttonStyle({ size: "md" })).toContain("px-4");
  });
});
