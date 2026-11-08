import {
  defaultFormValues,
  formValuesFromTemplate,
  parseFormValues,
  templateSummary,
  type RecurringFormValues,
} from "@/lib/recurring/form";

const base: RecurringFormValues = {
  name: "",
  frequency: "monthly",
  startDate: "2027-01-31",
  endDate: "",
  maxOccurrences: "",
  paymentTermDays: "8",
};

describe("defaultFormValues", () => {
  it("proposes the same day next month, clamped, on the Budapest day passed in", () => {
    expect(defaultFormValues("2026-11-08")).toMatchObject({ frequency: "monthly", startDate: "2026-12-08" });
    expect(defaultFormValues("2027-01-31").startDate).toBe("2027-02-28");
  });
});

describe("parseFormValues", () => {
  it("builds the schedule and trims empty optionals to null", () => {
    expect(parseFormValues({ ...base, name: "  Retainer " })).toEqual({
      ok: true,
      name: "Retainer",
      schedule: { frequency: "monthly", startDate: "2027-01-31", endDate: null, maxOccurrences: null },
      paymentTermDays: 8,
    });
  });
  it("parses end date and occurrence count", () => {
    const r = parseFormValues({ ...base, endDate: "2027-12-31", maxOccurrences: "12" });
    expect(r).toMatchObject({ ok: true, schedule: { endDate: "2027-12-31", maxOccurrences: 12 } });
  });
  it("rejects a bad date, an end before the start, and non-positive / fractional counts", () => {
    expect(parseFormValues({ ...base, startDate: "2027-02-30" })).toEqual({ ok: false, error: "invalidSchedule" });
    expect(parseFormValues({ ...base, endDate: "2026-01-01" })).toEqual({ ok: false, error: "invalidSchedule" });
    expect(parseFormValues({ ...base, maxOccurrences: "0" })).toEqual({ ok: false, error: "invalidSchedule" });
    expect(parseFormValues({ ...base, maxOccurrences: "2.5" })).toEqual({ ok: false, error: "invalidSchedule" });
    expect(parseFormValues({ ...base, maxOccurrences: "abc" })).toEqual({ ok: false, error: "invalidSchedule" });
  });
  it("rejects an invalid payment term", () => {
    expect(parseFormValues({ ...base, paymentTermDays: "-1" })).toEqual({ ok: false, error: "invalidSchedule" });
    expect(parseFormValues({ ...base, paymentTermDays: "400" })).toEqual({ ok: false, error: "invalidSchedule" });
  });
});

describe("formValuesFromTemplate / templateSummary", () => {
  const tpl = {
    name: "Retainer",
    clientName: "Acme Kft.",
    frequency: "quarterly" as const,
    startDate: "2027-03-31",
    endDate: undefined,
    maxOccurrences: 4,
    paymentTermDays: 15,
    currency: "EUR",
    lineItems: [
      { id: "a", description: "x", quantity: 2, unitPrice: 100, vatRate: 27 as const, vatCategory: "normal" as const },
    ],
  };
  it("round-trips into form values", () => {
    expect(formValuesFromTemplate(tpl)).toEqual({
      name: "Retainer",
      frequency: "quarterly",
      startDate: "2027-03-31",
      endDate: "",
      maxOccurrences: "4",
      paymentTermDays: "15",
    });
  });
  it("summarises the display name and gross amount", () => {
    expect(templateSummary(tpl)).toEqual({ title: "Retainer", partner: "Acme Kft.", gross: 254 });
    expect(templateSummary({ ...tpl, name: undefined }).title).toBe("Acme Kft.");
  });
});
