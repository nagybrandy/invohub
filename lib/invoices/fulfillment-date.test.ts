// lib/invoices/fulfillment-date.test.ts
import {
  normalizeFulfillmentDateInput,
  parseFulfillmentDateFromNotes,
  resolveFulfillmentDate,
} from "@/lib/invoices/fulfillment-date";

describe("parseFulfillmentDateFromNotes", () => {
  it("finds a Teljesítés: line", () => {
    expect(parseFulfillmentDateFromNotes("Köszönjük!\n\nTeljesítés: 2026-09-12")).toBe(
      "2026-09-12"
    );
  });

  it("finds the accentless Teljesites: spelling", () => {
    expect(parseFulfillmentDateFromNotes("Teljesites: 2026-09-12")).toBe("2026-09-12");
  });

  it("returns undefined for absent notes", () => {
    expect(parseFulfillmentDateFromNotes(undefined)).toBeUndefined();
    expect(parseFulfillmentDateFromNotes(null)).toBeUndefined();
  });

  it("returns undefined for empty notes", () => {
    expect(parseFulfillmentDateFromNotes("")).toBeUndefined();
  });

  it("returns undefined for garbage notes with no Teljesítés line", () => {
    expect(parseFulfillmentDateFromNotes("Csak egy random megjegyzés.")).toBeUndefined();
  });

  it("is not confused by a Fizetés: or Bankszámla: line in the same block", () => {
    const notes = ["Fizetés: Átutalás", "Bankszámla: 11773016-00000000"].join("\n");
    expect(parseFulfillmentDateFromNotes(notes)).toBeUndefined();
  });

  it("tolerates a trailing time part and still returns only the date", () => {
    expect(
      parseFulfillmentDateFromNotes("Teljesítés: 2026-09-12T10:00:00.000Z")
    ).toBe("2026-09-12");
  });

  it("never returns a non-YYYY-MM-DD string for an unparseable value", () => {
    expect(parseFulfillmentDateFromNotes("Teljesítés: hamarosan")).toBeUndefined();
  });
});

describe("resolveFulfillmentDate", () => {
  it("prefers the column over the notes line", () => {
    expect(resolveFulfillmentDate("2026-09-01", "Teljesítés: 2026-09-12")).toBe("2026-09-01");
  });

  it("falls back to the notes value when the column is null", () => {
    expect(resolveFulfillmentDate(null, "Teljesítés: 2026-09-12")).toBe("2026-09-12");
  });

  it("falls back to the notes value when the column is undefined", () => {
    expect(resolveFulfillmentDate(undefined, "Teljesítés: 2026-09-12")).toBe("2026-09-12");
  });

  it("returns undefined when neither the column nor the notes have a value", () => {
    expect(resolveFulfillmentDate(null, "Köszönjük!")).toBeUndefined();
    expect(resolveFulfillmentDate(undefined, undefined)).toBeUndefined();
  });
});

describe("normalizeFulfillmentDateInput", () => {
  it("passes a valid YYYY-MM-DD date through unchanged", () => {
    expect(normalizeFulfillmentDateInput("2026-09-12")).toBe("2026-09-12");
  });

  it("slices an ISO datetime down to its date part", () => {
    expect(normalizeFulfillmentDateInput("2026-09-12T10:00:00.000Z")).toBe("2026-09-12");
  });

  it("returns undefined for an empty string", () => {
    expect(normalizeFulfillmentDateInput("")).toBeUndefined();
  });

  it("returns undefined for null/undefined", () => {
    expect(normalizeFulfillmentDateInput(null)).toBeUndefined();
    expect(normalizeFulfillmentDateInput(undefined)).toBeUndefined();
  });

  it("returns null (the invalid signal) for a non-date string", () => {
    expect(normalizeFulfillmentDateInput("not-a-date")).toBeNull();
  });

  it("returns null (the invalid signal) for an impossible calendar date", () => {
    expect(normalizeFulfillmentDateInput("2026-13-45")).toBeNull();
  });

  it("returns null for a non-string value", () => {
    expect(normalizeFulfillmentDateInput(12345 as unknown as string)).toBeNull();
  });
});
