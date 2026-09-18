// lib/ui/tap-target.test.ts
import {
  MIN_TAP_TARGET_PX,
  TAP_TARGET_ICON_BOX,
  TAP_TARGET_MIN_H,
} from "@/lib/ui/tap-target";

describe("tap-target constants", () => {
  it("defines the 44px floor and its NativeWind min-height class", () => {
    expect(MIN_TAP_TARGET_PX).toBe(44);
    expect(TAP_TARGET_MIN_H).toBe("min-h-11");
  });

  it("defines a 44x44 centered icon-box class carrying the same floor", () => {
    expect(TAP_TARGET_ICON_BOX).toContain("h-11");
    expect(TAP_TARGET_ICON_BOX).toContain("w-11");
    expect(TAP_TARGET_ICON_BOX).toContain("items-center");
    expect(TAP_TARGET_ICON_BOX).toContain("justify-center");
  });
});
