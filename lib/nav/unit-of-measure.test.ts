// lib/nav/unit-of-measure.test.ts
import { navLineUnitOf, toNavUnitOfMeasure } from "@/lib/nav/unit-of-measure";
import { makeLineItem } from "@/__tests__/fixtures/invoices";

describe("toNavUnitOfMeasure", () => {
  it.each([
    ["db", "PIECE"],
    ["DB", "PIECE"],
    ["darab", "PIECE"],
    ["pcs", "PIECE"],
    ["óra", "HOUR"],
    ["h", "HOUR"],
    ["hour", "HOUR"],
    ["nap", "DAY"],
    ["day", "DAY"],
    ["hó", "MONTH"],
    ["hónap", "MONTH"],
    ["month", "MONTH"],
    ["perc", "MINUTE"],
    ["kg", "KILOGRAM"],
    ["t", "TON"],
    ["tonna", "TON"],
    ["km", "KILOMETER"],
    ["m", "METER"],
    ["fm", "LINEAR_METER"],
    ["m3", "CUBIC_METER"],
    ["m³", "CUBIC_METER"],
    ["l", "LITER"],
    ["liter", "LITER"],
    ["kWh", "KWH"],
    ["karton", "CARTON"],
    ["csomag", "PACK"],
  ])("maps %s to NAV %s with no unitOfMeasureOwn", (unit, expected) => {
    expect(toNavUnitOfMeasure(unit)).toEqual({ unitOfMeasure: expected });
  });

  it.each(["m²", "m2", "alkalom", "projekt"])(
    "maps %s (no NAV enum value) to OWN with the trimmed original as unitOfMeasureOwn",
    (unit) => {
      expect(toNavUnitOfMeasure(` ${unit} `)).toEqual({ unitOfMeasure: "OWN", unitOfMeasureOwn: unit });
    }
  );

  it("defaults a missing/blank unit to PIECE (the composer's default unit is db)", () => {
    expect(toNavUnitOfMeasure(undefined)).toEqual({ unitOfMeasure: "PIECE" });
    expect(toNavUnitOfMeasure("  ")).toEqual({ unitOfMeasure: "PIECE" });
  });

  it("truncates an over-long own unit to 50 characters (SimpleText50NotBlankType)", () => {
    const long = "x".repeat(80);
    expect(toNavUnitOfMeasure(long).unitOfMeasureOwn).toHaveLength(50);
  });
});

describe("navLineUnitOf", () => {
  it("reads the line item's unit (single accessor — switch here when the unit is persisted)", () => {
    expect(navLineUnitOf(makeLineItem({ unit: "óra" }))).toBe("óra");
    expect(navLineUnitOf(makeLineItem({ unit: undefined }))).toBeUndefined();
  });
});
