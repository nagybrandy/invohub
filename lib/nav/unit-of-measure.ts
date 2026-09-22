// lib/nav/unit-of-measure.ts
// Maps InvoHub's free-text line units (the composer offers db/óra/nap/hó/
// km/kg/m²/alkalom) onto NAV OSA 3.0 UnitOfMeasureType. The enum values
// below are the complete list from invoiceData.xsd (nav-gov-hu/Online-
// Invoice, fetched 2026-09-22): PIECE, KILOGRAM, TON, KWH, DAY, HOUR,
// MINUTE, MONTH, LITER, KILOMETER, CUBIC_METER, METER, LINEAR_METER,
// CARTON, PACK, OWN. There is no square-metre value, so m² (and anything
// else unrecognised) goes out as OWN + unitOfMeasureOwn.
import type { InvoiceLineItem } from "@/lib/invoices/types";

export type NavUnitOfMeasure =
  | "PIECE"
  | "KILOGRAM"
  | "TON"
  | "KWH"
  | "DAY"
  | "HOUR"
  | "MINUTE"
  | "MONTH"
  | "LITER"
  | "KILOMETER"
  | "CUBIC_METER"
  | "METER"
  | "LINEAR_METER"
  | "CARTON"
  | "PACK"
  | "OWN";

export type NavUnitResult = { unitOfMeasure: NavUnitOfMeasure; unitOfMeasureOwn?: string };

const UNIT_ALIASES: Record<string, Exclude<NavUnitOfMeasure, "OWN">> = {
  db: "PIECE",
  "db.": "PIECE",
  darab: "PIECE",
  pc: "PIECE",
  pcs: "PIECE",
  piece: "PIECE",
  óra: "HOUR",
  ó: "HOUR",
  h: "HOUR",
  hour: "HOUR",
  hours: "HOUR",
  nap: "DAY",
  day: "DAY",
  days: "DAY",
  hó: "MONTH",
  hónap: "MONTH",
  month: "MONTH",
  months: "MONTH",
  perc: "MINUTE",
  min: "MINUTE",
  minute: "MINUTE",
  kg: "KILOGRAM",
  kilogramm: "KILOGRAM",
  t: "TON",
  tonna: "TON",
  ton: "TON",
  km: "KILOMETER",
  kilométer: "KILOMETER",
  m: "METER",
  méter: "METER",
  fm: "LINEAR_METER",
  folyóméter: "LINEAR_METER",
  m3: "CUBIC_METER",
  "m³": "CUBIC_METER",
  l: "LITER",
  liter: "LITER",
  kwh: "KWH",
  karton: "CARTON",
  carton: "CARTON",
  csomag: "PACK",
  pack: "PACK",
};

/** unitOfMeasureOwn is SimpleText50NotBlankType. */
const OWN_UNIT_MAX_LENGTH = 50;

export function toNavUnitOfMeasure(unit: string | undefined | null): NavUnitResult {
  const trimmed = unit?.trim() ?? "";
  // The composer's default unit is "db"; a line with no unit at all is
  // reported as a piece rather than an empty/invalid OWN unit.
  if (!trimmed) return { unitOfMeasure: "PIECE" };
  const mapped = UNIT_ALIASES[trimmed.toLowerCase()];
  if (mapped) return { unitOfMeasure: mapped };
  return { unitOfMeasure: "OWN", unitOfMeasureOwn: trimmed.slice(0, OWN_UNIT_MAX_LENGTH) };
}

/**
 * The one place the NAV XML reads a line's unit from. Today that's the
 * in-memory InvoiceLineItem.unit; when the persisted line-item unit lands
 * (slice/buyer-address-and-unit-persist), switch only this accessor.
 */
export function navLineUnitOf(line: InvoiceLineItem): string | undefined {
  return line.unit;
}
