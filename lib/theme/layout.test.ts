// lib/theme/layout.test.ts
import { breakpointForWidth, LAYOUT } from "@/lib/theme/layout";

describe("LAYOUT / breakpoints (SPEC §3)", () => {
  it("has the redesign constants", () => {
    expect(LAYOUT.phoneMax).toBe(700);
    expect(LAYOUT.wideMin).toBe(1100);
    expect(LAYOUT.listCardsMax).toBe(820);
    expect(LAYOUT.sidebarWidth).toBe(248);
    expect(LAYOUT.sidebarCollapsed).toBe(72);
    expect(LAYOUT.topStripHeight).toBe(56);
    expect(LAYOUT.tabBarHeight).toBe(64);
    expect("desktopBreakpoint" in LAYOUT).toBe(false);
  });

  it.each([
    [320, "phone"],
    [375, "phone"],
    [700, "phone"],
    [701, "tablet"],
    [820, "tablet"],
    [1099, "tablet"],
    [1100, "wide"],
    [1440, "wide"],
  ])("%ipx is %s", (width, expected) => {
    expect(breakpointForWidth(width)).toBe(expected);
  });
});
