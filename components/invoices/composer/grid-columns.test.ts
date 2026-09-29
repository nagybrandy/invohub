// components/invoices/composer/grid-columns.test.ts
// Pure arithmetic pinning the step-2 grid's minimum width and the form
// column's available width at common desktop breakpoints (AC1, AC2). This
// is the whole point of the slice expressed as a number: at 1440px with the
// sidebar expanded, the 6-column row (860px) must fit the space the form
// column actually gets once the 400px ComposerSummary is gone from step 2.
import {
  COMPOSER_GRID_COLUMNS,
  composerFormColumnWidth,
  composerGridMinWidth,
} from "@/components/invoices/composer/grid-columns";

describe("COMPOSER_GRID_COLUMNS", () => {
  it("has exactly 6 entries with unique keys", () => {
    expect(COMPOSER_GRID_COLUMNS).toHaveLength(6);
    const keys = COMPOSER_GRID_COLUMNS.map((col) => col.key);
    expect(new Set(keys).size).toBe(6);
  });

  it("starts with the description column, flexible with a 240px floor", () => {
    expect(COMPOSER_GRID_COLUMNS[0]).toMatchObject({
      key: "description",
      minWidth: 240,
      flex: true,
    });
  });
});

describe("composerGridMinWidth", () => {
  it("returns 860 — the 6 column widths plus 5 x 8px gaps", () => {
    expect(composerGridMinWidth()).toBe(860);
  });
});

describe("composerFormColumnWidth", () => {
  it("returns 1112 at 1440px with the sidebar expanded and no summary column — fits the 860px grid", () => {
    const width = composerFormColumnWidth({ viewportWidth: 1440, sidebarWidth: 248, summaryWidth: 0 });
    expect(width).toBe(1112);
    expect(width).toBeGreaterThanOrEqual(composerGridMinWidth());
  });

  it("returns 680 at 1440px when the 400px summary column is still rendered — the regression this slice fixes", () => {
    const width = composerFormColumnWidth({ viewportWidth: 1440, sidebarWidth: 248, summaryWidth: 400 });
    expect(width).toBe(680);
    expect(width).toBeLessThan(composerGridMinWidth());
  });

  it("returns 1120 at 1440px with the sidebar collapsed and no summary column", () => {
    expect(composerFormColumnWidth({ viewportWidth: 1440, sidebarWidth: 72, summaryWidth: 0 })).toBe(1120);
  });

  it("returns 952 at 1280px with the sidebar expanded and no summary column", () => {
    expect(composerFormColumnWidth({ viewportWidth: 1280, sidebarWidth: 248, summaryWidth: 0 })).toBe(952);
  });

  it("exactly fits the grid minimum at 1188px with the sidebar expanded", () => {
    expect(composerFormColumnWidth({ viewportWidth: 1188, sidebarWidth: 248, summaryWidth: 0 })).toBe(860);
  });

  it("no longer fits below ~1188px — StepLineItems switches to compact cards there (responsive-line-item-grid)", () => {
    const width = composerFormColumnWidth({ viewportWidth: 1024, sidebarWidth: 248, summaryWidth: 0 });
    expect(width).toBe(696);
    expect(width).toBeLessThan(composerGridMinWidth());
  });
});

describe("lineItemLayoutForWidth (responsive-line-item-grid)", () => {
  const { lineItemLayoutForWidth } = require("@/components/invoices/composer/grid-columns");

  it("falls back to compact cards until the container has been measured", () => {
    expect(lineItemLayoutForWidth(null)).toBe("card");
    expect(lineItemLayoutForWidth(0)).toBe("card");
  });

  it("uses cards whenever the measured form column is narrower than the full grid", () => {
    expect(lineItemLayoutForWidth(320)).toBe("card");
    expect(lineItemLayoutForWidth(375)).toBe("card");
    // 1440px laptop, sidebar open + live PDF side preview: ~620px form column.
    expect(lineItemLayoutForWidth(620)).toBe("card");
    expect(lineItemLayoutForWidth(composerGridMinWidth() - 1)).toBe("card");
  });

  it("keeps the single-row grid once the container fits the full grid width", () => {
    expect(lineItemLayoutForWidth(composerGridMinWidth())).toBe("grid");
    expect(lineItemLayoutForWidth(1000)).toBe("grid");
  });
});
