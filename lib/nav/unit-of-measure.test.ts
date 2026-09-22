// lib/nav/unit-of-measure.test.ts
import { navLineUnitOf, toNavUnitOfMeasure } from "@/lib/nav/unit-of-measure";
import { makeLineItem } from "@/__tests__/fixtures/invoices";
import { mapLineItemFromDb } from "@/lib/invoices/mappers";

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
  it("reads the line item's unit", () => {
    expect(navLineUnitOf(makeLineItem({ unit: "óra" }))).toBe("óra");
    expect(navLineUnitOf(makeLineItem({ unit: undefined }))).toBeUndefined();
    expect(navLineUnitOf(makeLineItem({ unit: "  " }))).toBeUndefined();
  });

  it("uses the unit persisted on invoice_line_item (round-trips through mapLineItemFromDb)", () => {
    const line = mapLineItemFromDb({
      id: "li-1",
      invoiceId: "inv-1",
      description: "Tanácsadás",
      quantity: "2",
      unitPrice: "1000",
      vatRate: 27,
      vatCategory: "normal",
      vatExemptionReason: null,
      unit: "óra",
    } as unknown as Parameters<typeof mapLineItemFromDb>[0]);
    expect(navLineUnitOf(line)).toBe("óra");
    expect(toNavUnitOfMeasure(navLineUnitOf(line))).toEqual({ unitOfMeasure: "HOUR" });
  });

  it("reports a legacy line with no persisted unit (NULL) as PIECE", () => {
    const line = mapLineItemFromDb({
      id: "li-1",
      invoiceId: "inv-1",
      description: "Régi tétel",
      quantity: "1",
      unitPrice: "1000",
      vatRate: 27,
      vatCategory: "normal",
      vatExemptionReason: null,
      unit: null,
    } as unknown as Parameters<typeof mapLineItemFromDb>[0]);
    expect(toNavUnitOfMeasure(navLineUnitOf(line))).toEqual({ unitOfMeasure: "PIECE" });
  });
});
