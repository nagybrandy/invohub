// components/invoices/composer/grid-columns.test.ts
import {
  COMPACT_MAX_WIDTH,
  COMPOSER_GRID_COLUMNS,
  ROW_LAYOUT_MIN_WIDTH,
  fixedColumnsWidth,
  isCompactWidth,
  lineItemLayoutForWidth,
} from "@/components/invoices/composer/grid-columns";

describe("line-item row columns (tokens.md §6.18)", () => {
  it("uses the design's widths: Menny. 72, Egység 84, Egységár 112, ÁFA 112, Összesen 128, delete 34", () => {
    const widths = Object.fromEntries(COMPOSER_GRID_COLUMNS.map((c) => [c.key, c.width]));
    expect(widths).toMatchObject({ quantity: 72, unit: 84, unitPrice: 112, vat: 112, total: 128, actions: 34 });
  });

  it("lets Megnevezés grow", () => {
    const description = COMPOSER_GRID_COLUMNS.find((c) => c.key === "description")!;
    expect(description.width).toBeUndefined();
    expect(description.className).toContain("flex-1");
  });

  it("keeps the class names in step with the widths", () => {
    for (const col of COMPOSER_GRID_COLUMNS) {
      if (col.width) expect(col.className).toContain(`w-[${col.width}px]`);
    }
  });

  it("leaves room for a usable Megnevezés at the 820px threshold", () => {
    expect(ROW_LAYOUT_MIN_WIDTH - fixedColumnsWidth()).toBeGreaterThanOrEqual(200);
  });
});

describe("lineItemLayoutForWidth", () => {
  it("is one row per item from 820px and stacked below", () => {
    expect(lineItemLayoutForWidth(820)).toBe("row");
    expect(lineItemLayoutForWidth(1100)).toBe("row");
    expect(lineItemLayoutForWidth(819)).toBe("stacked");
    expect(lineItemLayoutForWidth(343)).toBe("stacked");
  });

  it("falls back to the layout that cannot overflow while unmeasured", () => {
    expect(lineItemLayoutForWidth(null)).toBe("stacked");
    expect(lineItemLayoutForWidth(0)).toBe("stacked");
  });
});

describe("isCompactWidth", () => {
  it("moves Összesen to its own line on narrow containers", () => {
    expect(isCompactWidth(COMPACT_MAX_WIDTH - 1)).toBe(true);
    expect(isCompactWidth(COMPACT_MAX_WIDTH)).toBe(false);
    expect(isCompactWidth(null)).toBe(true);
  });
});
