// lib/ui/tap-target.test.ts
import {
  MIN_TAP_TARGET_PX,
  TAP_SLOP_PX,
  TAP_TARGET_DROPDOWN_TOP,
  TAP_TARGET_H,
  TAP_TARGET_ICON_BOX,
  TAP_TARGET_MIN_H,
  hitSlopExcept,
  touchOverlapPx,
} from "@/lib/ui/tap-target";

describe("tap-target constants", () => {
  it("defines the 44px floor and its NativeWind min-height class", () => {
    expect(MIN_TAP_TARGET_PX).toBe(44);
    expect(TAP_TARGET_MIN_H).toBe("min-h-11");
  });

  it("defines a fixed 44px height class for controls that need a definite height", () => {
    expect(TAP_TARGET_H).toBe("h-11");
  });

  it("defines a 44x44 centered icon-box class carrying the same floor", () => {
    expect(TAP_TARGET_ICON_BOX).toContain("h-11");
    expect(TAP_TARGET_ICON_BOX).toContain("w-11");
    expect(TAP_TARGET_ICON_BOX).toContain("items-center");
    expect(TAP_TARGET_ICON_BOX).toContain("justify-center");
  });

  it("derives the icon-box class from TAP_TARGET_H, so the floor cannot drift back to a literal", () => {
    expect(TAP_TARGET_ICON_BOX.startsWith(TAP_TARGET_H)).toBe(true);
  });

  it("derives the dropdown top offset from TAP_TARGET_H, so a menu anchored under a 44px row can't fall back to a stale literal", () => {
    expect(TAP_TARGET_DROPDOWN_TOP).toBe("top-11");
    expect(TAP_TARGET_DROPDOWN_TOP).toBe(TAP_TARGET_H.replace("h-", "top-"));
  });

  it("defines the default outward touch slop, unchanged for every non-facing side", () => {
    expect(TAP_SLOP_PX).toBe(8);
  });
});

describe("touchOverlapPx", () => {
  it("computes the contested band between two facing slopped edges", () => {
    expect(touchOverlapPx(4, 8, 8)).toBe(12);
    expect(touchOverlapPx(4, 8, 0)).toBe(0);
    expect(touchOverlapPx(13, 8, 8)).toBe(3);
  });

  it("clamps a non-overlapping pair to 0, never negative", () => {
    expect(touchOverlapPx(20, 8, 8)).toBe(0);
  });
});

describe("hitSlopExcept", () => {
  it("returns the default slop on every side when nothing is excluded", () => {
    expect(hitSlopExcept([])).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
  });

  it("zeroes only the excluded side", () => {
    expect(hitSlopExcept(["right"])).toEqual({ top: 8, right: 0, bottom: 8, left: 8 });
  });

  it("zeroes multiple excluded sides and honors a custom slop", () => {
    expect(hitSlopExcept(["left", "right"], 12)).toEqual({
      top: 12,
      right: 0,
      bottom: 12,
      left: 0,
    });
  });
});

describe("header action cluster geometry", () => {
  // Distance between the bell's visible box and the LanguageSwitcher's
  // visible box: HStack `gap-2` (8px) minus the switcher's own `border`
  // (1px) + `p-1` (4px) inset on the side facing the bell = 13px.
  const HEADER_GAP_PX = 8;
  const SWITCHER_EDGE_INSET_PX = 5;
  // Box-to-box gap between the bell and the switcher's first pill: the 8px
  // HStack gap-2 between the bell's and switcher's outer edges, plus the
  // switcher's own 5px border(1px)+p-1(4px) inset from its outer edge down
  // to its first pill's visible edge.
  const BELL_TO_HU_PILL_GAP_PX = HEADER_GAP_PX + SWITCHER_EDGE_INSET_PX; // 13px
  // Gap between the HU and EN pills inside the switcher: HStack `gap-1`.
  const PILL_GAP_PX = 4;

  it("bell↔switcher boundary is not contested once the bell's right slop is trimmed", () => {
    const bellSlop = hitSlopExcept(["right"]);
    const switcherLeftSlop = TAP_SLOP_PX; // switcher's first pill keeps outward left slop
    expect(touchOverlapPx(BELL_TO_HU_PILL_GAP_PX, bellSlop.right, switcherLeftSlop)).toBe(0);
  });

  it("HU↔EN boundary is not contested once both facing sides are trimmed", () => {
    const huSlop = hitSlopExcept(["right"]);
    const enSlop = hitSlopExcept(["left"]);
    expect(touchOverlapPx(PILL_GAP_PX, huSlop.right, enSlop.left)).toBe(0);
  });
});
